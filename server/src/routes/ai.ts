import { Router, Response } from 'express';
import OpenAI from 'openai';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { query } from '../db';
import { config } from '../config';

const router = Router();
router.use(authenticate as any);

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_team_performance',
      description: 'Get today\'s call performance metrics for all agents in the manager\'s country. Returns calls made, connects, conversions, and connect rate per agent.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_agent_list',
      description: 'List all agents in the manager\'s country with their current online/offline status and assigned lead count.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_lead_stats',
      description: 'Get lead statistics by category: High Staker, Medium Staker, Frequent Bettor, dormant, pipeline (interested/promised), unassigned, and total.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_call_notes',
      description: 'Get the most recent call notes and dispositions made by all agents in the last N hours. Useful for summarizing call activity.',
      parameters: {
        type: 'object',
        properties: {
          hours: { type: 'number', description: 'Number of hours to look back (default 24)' },
          limit: { type: 'number', description: 'Max number of notes to return (default 30)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_import_history',
      description: 'Get recent lead import history — who imported, when, and how many leads.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_distribution_stats',
      description: 'Get the current lead distribution: how many leads are unassigned vs assigned per agent.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_leads_by_category',
      description: 'Clear (delete) leads in a specific category for the manager\'s country. This is a destructive action. Category options: High Staker, Medium Staker, Frequent Bettor, active, dormant, pipeline, unassigned, all.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['High Staker', 'Medium Staker', 'Frequent Bettor', 'active', 'dormant', 'pipeline', 'unassigned', 'all'],
            description: 'The category of leads to clear',
          },
          confirmed: {
            type: 'boolean',
            description: 'Must be true before deleting. If false, return a confirmation message first.',
          },
        },
        required: ['category', 'confirmed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_performing_agents',
      description: 'Get a ranked list of top performing agents by conversion rate or calls made over a given number of days.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Number of days to look back (default 7)' },
          rank_by: { type: 'string', enum: ['conversions', 'calls', 'connect_rate'], description: 'Metric to rank by' },
        },
        required: [],
      },
    },
  },
];

// ─── Tool Executors ───────────────────────────────────────────────────────────

async function getManagerCountry(userId: string): Promise<string | null> {
  const r = await query('SELECT country FROM profiles WHERE id = $1', [userId]);
  return r.rows[0]?.country || null;
}

async function executeTool(toolName: string, args: any, userId: string): Promise<string> {
  const country = await getManagerCountry(userId);
  if (!country) return JSON.stringify({ error: 'Could not determine your country' });

  try {
    switch (toolName) {

      case 'get_team_performance': {
        const r = await query(`
          SELECT p.full_name, p.email, p.status,
                 COALESCE(dm.calls_made, 0) as calls_made,
                 COALESCE(dm.connects, 0) as connects,
                 COALESCE(dm.conversions, 0) as conversions,
                 COALESCE(dm.talk_time_seconds, 0) as talk_time_seconds
          FROM profiles p
          JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'agent'
          LEFT JOIN daily_metrics dm ON dm.user_id = p.id AND dm.date = CURRENT_DATE
          WHERE p.country = $1 AND p.approved = TRUE
          ORDER BY COALESCE(dm.calls_made, 0) DESC`, [country]);
        return JSON.stringify(r.rows);
      }

      case 'get_agent_list': {
        const r = await query(`
          SELECT p.full_name, p.email, p.status, p.country,
                 COUNT(l.id) as assigned_leads
          FROM profiles p
          JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'agent'
          LEFT JOIN leads l ON l.user_id = p.id
          WHERE p.country = $1 AND p.approved = TRUE
          GROUP BY p.id, p.full_name, p.email, p.status, p.country
          ORDER BY p.status DESC, p.full_name`, [country]);
        return JSON.stringify(r.rows);
      }

      case 'get_lead_stats': {
        const r = await query(`
          SELECT
            COUNT(*) FILTER (WHERE trait = 'High Staker') as high_staker,
            COUNT(*) FILTER (WHERE trait = 'Medium Staker') as medium_staker,
            COUNT(*) FILTER (WHERE trait = 'Frequent Bettor') as frequent_bettor,
            COUNT(*) FILTER (WHERE segment = 'semi-active') as active,
            COUNT(*) FILTER (WHERE segment = 'dormant' OR trait = 'Dormant') as dormant,
            COUNT(*) FILTER (WHERE lifecycle_stage IN ('interested','promised')) as pipeline,
            COUNT(*) FILTER (WHERE user_id IS NULL) as unassigned,
            COUNT(*) as total
          FROM leads WHERE country = $1`, [country]);
        return JSON.stringify(r.rows[0]);
      }

      case 'get_recent_call_notes': {
        const hours = args.hours || 24;
        const limit = args.limit || 30;
        const r = await query(`
          SELECT ca.status, ca.notes, ca.start_time, ca.duration_seconds,
                 p.full_name as agent_name,
                 l.name as lead_name, l.phone
          FROM call_activities ca
          JOIN profiles p ON p.id = ca.user_id
          LEFT JOIN leads l ON l.id = ca.lead_id
          WHERE p.country = $1
            AND ca.start_time >= NOW() - INTERVAL '${Math.floor(hours)} hours'
            AND ca.notes IS NOT NULL AND ca.notes != ''
          ORDER BY ca.start_time DESC
          LIMIT $2`, [country, limit]);
        return JSON.stringify(r.rows);
      }

      case 'get_import_history': {
        const r = await query(`
          SELECT b.created_at, b.total_rows, b.imported_rows, b.skipped_rows,
                 p.full_name as imported_by
          FROM import_batches b
          LEFT JOIN profiles p ON p.id = b.user_id
          WHERE b.user_id IN (SELECT id FROM profiles WHERE country = $1)
          ORDER BY b.created_at DESC LIMIT 10`, [country]);
        return JSON.stringify(r.rows);
      }

      case 'get_distribution_stats': {
        const unassigned = await query(`SELECT COUNT(*) as count FROM leads WHERE user_id IS NULL AND country = $1`, [country]);
        const perAgent = await query(`
          SELECT p.full_name, COUNT(l.id) as lead_count
          FROM profiles p
          JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'agent'
          LEFT JOIN leads l ON l.user_id = p.id
          WHERE p.country = $1 AND p.approved = TRUE
          GROUP BY p.id, p.full_name ORDER BY lead_count DESC`, [country]);
        return JSON.stringify({ unassigned: unassigned.rows[0].count, per_agent: perAgent.rows });
      }

      case 'clear_leads_by_category': {
        if (!args.confirmed) {
          return JSON.stringify({ requires_confirmation: true, message: `You're about to clear all "${args.category}" leads for your country (${country}). Please confirm this action.` });
        }
        let whereClause = `country = $1`;
        if (args.category === 'unassigned') whereClause += ` AND user_id IS NULL`;
        else if (args.category === 'dormant') whereClause += ` AND (segment = 'dormant' OR trait = 'Dormant')`;
        else if (args.category === 'pipeline') whereClause += ` AND lifecycle_stage IN ('interested','promised')`;
        else if (args.category === 'active') whereClause += ` AND segment = 'semi-active'`;
        else if (args.category === 'all') { /* delete all */ }
        else whereClause += ` AND trait = $2`;

        const deleteQuery = args.category !== 'all' && !['unassigned','dormant','pipeline','active'].includes(args.category)
          ? await query(`DELETE FROM leads WHERE ${whereClause} RETURNING id`, [country, args.category])
          : await query(`DELETE FROM leads WHERE ${whereClause} RETURNING id`, [country]);
        return JSON.stringify({ deleted: deleteQuery.rowCount, category: args.category });
      }

      case 'get_top_performing_agents': {
        const days = args.days || 7;
        const rankBy = args.rank_by || 'conversions';
        const orderCol = rankBy === 'calls' ? 'total_calls' : rankBy === 'connect_rate' ? 'connect_rate' : 'total_conversions';
        const r = await query(`
          SELECT p.full_name,
                 SUM(dm.calls_made) as total_calls,
                 SUM(dm.connects) as total_connects,
                 SUM(dm.conversions) as total_conversions,
                 CASE WHEN SUM(dm.calls_made) > 0
                      THEN ROUND((SUM(dm.connects)::numeric / SUM(dm.calls_made)) * 100, 1)
                      ELSE 0 END as connect_rate
          FROM daily_metrics dm
          JOIN profiles p ON p.id = dm.user_id
          WHERE p.country = $1 AND dm.date >= CURRENT_DATE - INTERVAL '${Math.floor(days)} days'
          GROUP BY p.id, p.full_name
          ORDER BY ${orderCol} DESC LIMIT 10`, [country]);
        return JSON.stringify(r.rows);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err: any) {
    console.error(`[AI Tool Error] ${toolName}:`, err.message);
    return JSON.stringify({ error: err.message });
  }
}

// ─── POST /ai/assistant ───────────────────────────────────────────────────────

router.post('/assistant', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { messages } = req.body as { messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] };
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const managerProfile = await query(
      `SELECT p.full_name, p.country FROM profiles p WHERE p.id = $1`,
      [req.user!.id]
    );
    const managerName = managerProfile.rows[0]?.full_name || 'Manager';
    const managerCountry = managerProfile.rows[0]?.country || 'Unknown';

    const systemPrompt = `You are BetBot, an intelligent AI assistant embedded inside the BangBet Dialer management app. You are speaking with ${managerName}, a manager for the ${managerCountry} team.

Your role is to help managers be more effective by:
- Analyzing agent performance and giving actionable coaching advice
- Summarizing call activity and lead pipeline health
- Spotting agents who may need support (low calls, poor results)
- Helping manage leads (clearing stale leads, checking distribution)
- Answering questions about team stats quickly

Personality: You are sharp, concise, and supportive. Use emojis sparingly but effectively. Format responses with markdown where helpful (bullet lists, bold key numbers).

Important rules:
- ALWAYS use tools to get real data before answering data-related questions
- For destructive actions (clearing leads), ALWAYS ask for confirmation first, set confirmed=false initially
- Never make up statistics — pull them from the tools
- Country scope: All data you fetch is already limited to ${managerCountry}
- Respond in English unless the manager writes in another language`;

    const allMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // Agentic loop — keep calling until no more tool calls
    let loopMessages = [...allMessages];
    let finalResponse = '';

    for (let iteration = 0; iteration < 5; iteration++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: loopMessages,
        tools,
        tool_choice: 'auto',
        max_tokens: 1024,
        temperature: 0.4,
      });

      const choice = completion.choices[0];

      if (choice.finish_reason === 'stop' || !choice.message.tool_calls) {
        finalResponse = choice.message.content || '';
        break;
      }

      // Execute tool calls in parallel
      loopMessages.push(choice.message);

      const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = await Promise.all(
        choice.message.tool_calls.map(async (tc) => {
          const args = JSON.parse(tc.function.arguments || '{}');
          const result = await executeTool(tc.function.name, args, req.user!.id);
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content: result,
          };
        })
      );

      loopMessages.push(...toolResults);
    }

    res.json({ reply: finalResponse });
  } catch (err: any) {
    console.error('[AI Assistant] Error:', err);
    res.status(500).json({ error: err.message || 'AI assistant failed' });
  }
});

// ─── GET /ai/suggestion ── proactive suggestion for the floating bubble ────────

router.get('/suggestion', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const country = await getManagerCountry(req.user!.id);
    if (!country) return res.status(400).json({ error: 'Country not found' });

    const [metrics, leads, unassigned] = await Promise.all([
      query(`SELECT SUM(calls_made) as calls, SUM(connects) as connects, SUM(conversions) as conversions
             FROM daily_metrics dm JOIN profiles p ON p.id = dm.user_id
             WHERE p.country = $1 AND dm.date = CURRENT_DATE`, [country]),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE user_id IS NULL) as unassigned FROM leads WHERE country = $1`, [country]),
      query(`SELECT COUNT(*) as offline FROM profiles p JOIN user_roles ur ON ur.user_id = p.id
             WHERE ur.role = 'agent' AND p.approved = TRUE AND p.country = $1 AND p.status = 'offline'`, [country]),
    ]);

    const calls = Number(metrics.rows[0]?.calls || 0);
    const connects = Number(metrics.rows[0]?.connects || 0);
    const conversions = Number(metrics.rows[0]?.conversions || 0);
    const unassignedCount = Number(leads.rows[0]?.unassigned || 0);
    const offlineAgents = Number(unassigned.rows[0]?.offline || 0);
    const connectRate = calls > 0 ? Math.round((connects / calls) * 100) : 0;

    // Pick the most relevant suggestion
    const suggestions = [];

    if (calls === 0) suggestions.push({ icon: '🚀', text: 'No calls yet today — check if agents are online and ready!' });
    if (unassignedCount > 50) suggestions.push({ icon: '📋', text: `${unassignedCount} leads are unassigned. Distribute them to your agents?` });
    if (unassignedCount > 0 && unassignedCount <= 50) suggestions.push({ icon: '📋', text: `${unassignedCount} leads waiting to be assigned — want me to show the distribution?` });
    if (connectRate < 20 && calls > 10) suggestions.push({ icon: '📉', text: `Connect rate is only ${connectRate}% today. Ask me who's struggling.` });
    if (conversions === 0 && calls > 20) suggestions.push({ icon: '💰', text: `No conversions yet after ${calls} calls. Want a performance summary?` });
    if (offlineAgents > 2) suggestions.push({ icon: '😴', text: `${offlineAgents} agents are offline. Want to see who's not logged in?` });
    if (calls > 50 && connectRate >= 30) suggestions.push({ icon: '🔥', text: `Great progress! ${calls} calls with ${connectRate}% connect rate. See top performers?` });
    suggestions.push({ icon: '📊', text: 'Ask me to summarize today\'s team performance in one message.' });

    const suggestion = suggestions[Math.floor(Math.random() * Math.min(3, suggestions.length))];
    res.json(suggestion);
  } catch (err: any) {
    res.json({ icon: '💬', text: 'Ask me anything about your team!' });
  }
});

export default router;
