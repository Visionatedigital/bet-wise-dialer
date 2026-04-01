import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);

// GET /leads - get leads for current user (or all if admin)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = ['admin', 'management', 'moderator'].includes(req.user!.role);
    const { campaign_id, status, limit = 100, offset = 0, user_id } = req.query;

    let sql = 'SELECT l.*, c.name as campaign_name FROM leads l LEFT JOIN campaigns c ON c.id = l.campaign_id WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (!isAdmin) {
      sql += ` AND l.user_id = $${paramCount++}`;
      params.push(req.user!.id);
    } else if (user_id) {
      sql += ` AND l.user_id = $${paramCount++}`;
      params.push(user_id);
    }

    if (campaign_id) {
      sql += ` AND l.campaign_id = $${paramCount++}`;
      params.push(campaign_id);
    }

    sql += ` ORDER BY l.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(Number(limit), Number(offset));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch leads' }); }
});

// GET /leads/unassigned - get count and list of unassigned leads (admin)
router.get('/unassigned', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const countResult = await query('SELECT COUNT(*) FROM leads WHERE user_id IS NULL');
    const result = await query(
      `SELECT l.*, c.name as campaign_name FROM leads l
       LEFT JOIN campaigns c ON c.id = l.campaign_id
       WHERE l.user_id IS NULL
       ORDER BY COALESCE(l.lead_score, l.score, 0) DESC, l.created_at ASC
       LIMIT $1 OFFSET $2`,
      [Number(limit), Number(offset)]
    );
    res.json({ total: parseInt(countResult.rows[0].count), leads: result.rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch unassigned leads' }); }
});

// GET /leads/agents-available - get approved agents for distribution (admin)
router.get('/agents-available', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT p.id, p.full_name, p.email, p.status, p.manager_id,
              r.role,
              COUNT(l.id) as assigned_leads,
              COALESCE(SUM(COALESCE(l.lead_score, l.score, 0)), 0) as total_score
       FROM profiles p
       JOIN user_roles r ON r.user_id = p.id AND r.role = 'agent'
       LEFT JOIN leads l ON l.user_id = p.id
       WHERE p.approved = TRUE
       GROUP BY p.id, p.full_name, p.email, p.status, p.manager_id, r.role
       ORDER BY p.full_name`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch available agents' }); }
});

// GET /leads/distribution-stats - current distribution overview (admin)
router.get('/distribution-stats', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const [unassigned, perAgent, totalLeads] = await Promise.all([
      query('SELECT COUNT(*) FROM leads WHERE user_id IS NULL'),
      query(
        `SELECT p.id, p.full_name, p.status,
                COUNT(l.id) as lead_count,
                COALESCE(SUM(COALESCE(l.lead_score, l.score, 0)), 0) as total_score,
                COALESCE(AVG(COALESCE(l.lead_score, l.score, 0)), 0) as avg_score
         FROM profiles p
         JOIN user_roles r ON r.user_id = p.id AND r.role = 'agent'
         LEFT JOIN leads l ON l.user_id = p.id
         WHERE p.approved = TRUE
         GROUP BY p.id, p.full_name, p.status
         ORDER BY lead_count DESC`
      ),
      query('SELECT COUNT(*) FROM leads'),
    ]);
    res.json({
      total_leads: parseInt(totalLeads.rows[0].count),
      unassigned_leads: parseInt(unassigned.rows[0].count),
      agents: perAgent.rows,
    });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch distribution stats' }); }
});

// POST /leads/import-csv - bulk import leads from CSV data (admin/management)
router.post('/import-csv', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { numbers, distribute_to } = req.body;
    // numbers: string[] of phone numbers
    // distribute_to: string[] of agent IDs (optional - if provided, distribute evenly)

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'Provide an array of phone numbers' });
    }

    // Clean and deduplicate numbers
    const cleaned = [...new Set(
      numbers
        .map((n: string) => n.toString().replace(/[^0-9+]/g, '').trim())
        .filter((n: string) => n.length >= 7)
    )];

    if (cleaned.length === 0) {
      return res.status(400).json({ error: 'No valid phone numbers found' });
    }

    // Check which numbers already exist
    const existing = await query(
      'SELECT phone FROM leads WHERE phone = ANY($1)',
      [cleaned]
    );
    const existingSet = new Set(existing.rows.map((r: any) => r.phone));
    const newNumbers = cleaned.filter((n: string) => !existingSet.has(n));

    if (newNumbers.length === 0) {
      return res.json({
        message: 'All numbers already exist in database',
        imported: 0,
        duplicates: cleaned.length,
        distributed: 0,
      });
    }

    // Insert new leads (unassigned, no name - use phone-based display)
    const insertValues: string[] = [];
    const insertParams: any[] = [];
    let paramIdx = 1;

    for (const phone of newNumbers) {
      const last4 = phone.replace(/[^0-9]/g, '').slice(-4);
      const displayName = `User ${last4}`;
      insertValues.push(`($${paramIdx++}, $${paramIdx++})`);
      insertParams.push(displayName, phone);
    }

    await query(
      `INSERT INTO leads (name, phone) VALUES ${insertValues.join(', ')}`,
      insertParams
    );

    let distributed = 0;

    // If distribute_to is provided, distribute the new leads to those agents
    if (distribute_to && distribute_to.length > 0) {
      // Get the newly inserted lead IDs
      const newLeads = await query(
        'SELECT id FROM leads WHERE phone = ANY($1) AND user_id IS NULL ORDER BY created_at DESC',
        [newNumbers]
      );

      const leadIds = newLeads.rows.map((r: any) => r.id);

      // Round-robin distribution
      for (let i = 0; i < leadIds.length; i++) {
        const agentId = distribute_to[i % distribute_to.length];
        await query(
          'UPDATE leads SET user_id = $1, assigned_by = $2, assigned_at = NOW() WHERE id = $3',
          [agentId, req.user!.id, leadIds[i]]
        );
      }
      distributed = leadIds.length;
    }

    res.status(201).json({
      message: `Imported ${newNumbers.length} numbers${distributed > 0 ? `, distributed to ${distribute_to.length} agents` : ''}`,
      imported: newNumbers.length,
      duplicates: cleaned.length - newNumbers.length,
      distributed,
    });
  } catch (err: any) {
    console.error('[Leads] CSV import error:', err);
    res.status(500).json({ error: 'Failed to import leads' });
  }
});

// POST /leads
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, segment = 'general', priority = 'medium', campaign, campaign_id, ...rest } = req.body;
    const result = await query(
      `INSERT INTO leads (user_id, name, phone, segment, priority, campaign, campaign_id, intent, tags, last_bet_date, last_deposit_ugx, score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [req.user!.id, name, phone, segment, priority, campaign, campaign_id, rest.intent, rest.tags, rest.last_bet_date, rest.last_deposit_ugx, rest.score]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to create lead' }); }
});

// GET /leads/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch lead' }); }
});

// PATCH /leads/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const fields = req.body;
    const setClauses = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = Object.values(fields);
    const result = await query(
      `UPDATE leads SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update lead' }); }
});

// DELETE /leads/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    res.json({ message: 'Lead deleted' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete lead' }); }
});

// POST /leads/distribute - smart fair distribution (admin only)
// Uses the same score-based fairness algorithm as the desktop app
router.post('/distribute', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { agent_ids, lead_ids, limit: leadLimit } = req.body;

    // Get target agents - either specified or all approved agents
    let agents: { id: string; full_name: string }[];
    if (agent_ids && agent_ids.length > 0) {
      const agentResult = await query(
        `SELECT p.id, p.full_name FROM profiles p
         JOIN user_roles r ON r.user_id = p.id AND r.role = 'agent'
         WHERE p.approved = TRUE AND p.id = ANY($1)`,
        [agent_ids]
      );
      agents = agentResult.rows;
    } else {
      const agentResult = await query(
        `SELECT p.id, p.full_name FROM profiles p
         JOIN user_roles r ON r.user_id = p.id AND r.role = 'agent'
         WHERE p.approved = TRUE
         ORDER BY p.full_name`
      );
      agents = agentResult.rows;
    }

    if (agents.length === 0) {
      return res.status(400).json({ error: 'No approved agents available for distribution' });
    }

    // Get leads to distribute - either specified or all unassigned
    let leads: { id: string; lead_score: number }[];
    if (lead_ids && lead_ids.length > 0) {
      const leadResult = await query(
        `SELECT id, COALESCE(lead_score, score, 0) as lead_score FROM leads
         WHERE id = ANY($1) ORDER BY COALESCE(lead_score, score, 0) DESC`,
        [lead_ids]
      );
      leads = leadResult.rows;
    } else {
      const queryLimit = leadLimit ? `LIMIT ${parseInt(leadLimit)}` : '';
      const leadResult = await query(
        `SELECT id, COALESCE(lead_score, score, 0) as lead_score FROM leads
         WHERE user_id IS NULL
         ORDER BY COALESCE(lead_score, score, 0) DESC ${queryLimit}`
      );
      leads = leadResult.rows;
    }

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No leads available for distribution' });
    }

    // Fair distribution algorithm (same as desktop AdminDashboard)
    // Tracks total score and count per agent, assigns each lead to the agent
    // with the lowest total score (fairness by value), breaking ties by count
    const agentStats: Map<string, { count: number; totalScore: number; name: string }> = new Map();
    for (const agent of agents) {
      agentStats.set(agent.id, { count: 0, totalScore: 0, name: agent.full_name });
    }

    const assignments: { leadId: string; agentId: string }[] = [];

    for (const lead of leads) {
      // Find agent with lowest total score, then lowest count
      let bestAgentId = agents[0].id;
      let bestStats = agentStats.get(bestAgentId)!;

      for (const agent of agents) {
        const stats = agentStats.get(agent.id)!;
        if (
          stats.totalScore < bestStats.totalScore ||
          (stats.totalScore === bestStats.totalScore && stats.count < bestStats.count)
        ) {
          bestAgentId = agent.id;
          bestStats = stats;
        }
      }

      assignments.push({ leadId: lead.id, agentId: bestAgentId });
      bestStats.count++;
      bestStats.totalScore += lead.lead_score;
    }

    // Batch update in groups of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const batch = assignments.slice(i, i + BATCH_SIZE);
      const promises = batch.map(({ leadId, agentId }) =>
        query(
          'UPDATE leads SET user_id = $1, assigned_by = $2, assigned_at = NOW(), updated_at = NOW() WHERE id = $3',
          [agentId, req.user!.id, leadId]
        )
      );
      await Promise.all(promises);
    }

    // Build summary per agent
    const summary = Array.from(agentStats.entries()).map(([id, stats]) => ({
      agent_id: id,
      agent_name: stats.name,
      leads_assigned: stats.count,
      total_score: stats.totalScore,
    }));

    res.json({
      message: `Distributed ${assignments.length} leads to ${agents.length} agents`,
      total_distributed: assignments.length,
      agents: summary,
    });
  } catch (err) {
    console.error('[Leads] Distribution error:', err);
    res.status(500).json({ error: 'Failed to distribute leads' });
  }
});

// POST /leads/unassign-all - remove all lead assignments (admin only)
router.post('/unassign-all', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'UPDATE leads SET user_id = NULL, assigned_by = NULL, assigned_at = NULL, updated_at = NOW() WHERE user_id IS NOT NULL'
    );
    res.json({ message: `Unassigned ${result.rowCount} leads` });
  } catch (err) { res.status(500).json({ error: 'Failed to unassign leads' }); }
});

export default router;
