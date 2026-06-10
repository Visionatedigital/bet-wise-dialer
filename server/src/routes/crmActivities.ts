import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import OpenAI from 'openai';
import { config } from '../config';
import multer from 'multer';

const router = Router();
router.use(authenticate as any);

const openai = new OpenAI({ apiKey: config.openai.apiKey });
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/crm/activities/log
 * Generic activity logging (WhatsApp reply, Call, Note, etc.)
 */
router.post('/log', async (req: AuthRequest, res: Response) => {
  try {
    const {
      lead_id,
      activity_type,
      channel,
      title,
      summary,
      sentiment,
      intent,
      outcome,
      next_action,
      suggested_reply,
      follow_up_due_at,
      priority_score,
      metadata = {},
      session_id // Optional: link to a pending session
    } = req.body;

    const agent_id = req.user!.id;

    // 1. Insert into lead_activities
    const activityResult = await query(
      `INSERT INTO lead_activities (
        lead_id, agent_id, activity_type, channel, title, summary, 
        sentiment, intent, outcome, next_action, suggested_reply, 
        follow_up_due_at, priority_score, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
      RETURNING id`,
      [
        lead_id, agent_id, activity_type, channel, title, summary, 
        sentiment, intent, outcome, next_action, suggested_reply, 
        follow_up_due_at, priority_score, JSON.stringify(metadata)
      ]
    );

    const activityId = activityResult.rows[0].id;

    // 2. Update Lead profile
    await query(
      `UPDATE leads SET 
        status = $1,
        next_action = $2,
        follow_up_due_at = $3,
        priority_score = $4,
        has_pending_action = $5,
        last_crm_contact_at = NOW(),
        updated_at = NOW()
      WHERE id = $6`,
      [
        outcome || 'Active',
        next_action,
        follow_up_due_at,
        priority_score || 0,
        activity_type === 'whatsapp_opened' || activity_type === 'follow_up_needed',
        lead_id
      ]
    );

    // 3. If there was a pending session, close it
    if (session_id) {
      await query(
        `UPDATE whatsapp_sessions SET 
          status = 'reply_logged', 
          awaiting_reply = FALSE, 
          closed_at = NOW(), 
          updated_at = NOW() 
        WHERE id = $1`,
        [session_id]
      );
    }

    res.json({ success: true, activity_id: activityId });
  } catch (err) {
    console.error('[CRM Activities] Log error:', err);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

/**
 * POST /api/crm/activities/whatsapp/start
 * Starts a WhatsApp pending session
 */
router.post('/whatsapp/start', async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id, phone_number, reason_for_contact, suggested_message, final_message } = req.body;
    const agent_id = req.user!.id;

    // 1. Create WhatsApp session
    const sessionResult = await query(
      `INSERT INTO whatsapp_sessions (
        contact_id, agent_id, phone_number, reason_for_contact, suggested_message, final_message, status, awaiting_reply
      ) VALUES ($1, $2, $3, $4, $5, $6, 'opened_whatsapp', TRUE) RETURNING id`,
      [lead_id, agent_id, phone_number, reason_for_contact, suggested_message, final_message]
    );

    const sessionId = sessionResult.rows[0].id;

    // 2. Add to timeline
    await query(
      `INSERT INTO lead_activities (
        lead_id, agent_id, activity_type, channel, title, summary, next_action, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        lead_id, agent_id, 'whatsapp_opened', 'whatsapp', 
        'WhatsApp Contact Initiated', 
        `Agent opened WhatsApp for: ${reason_for_contact}. Message prefilled.`,
        'Log client reply when received',
        'pending',
        JSON.stringify({ session_id: sessionId, reason: reason_for_contact })
      ]
    );

    // 3. Update Lead
    await query(
      `UPDATE leads SET 
        has_pending_action = TRUE, 
        pending_action_type = 'whatsapp_reply',
        last_crm_contact_at = NOW(),
        updated_at = NOW() 
      WHERE id = $1`,
      [lead_id]
    );

    res.json({ success: true, session_id: sessionId });
  } catch (err) {
    console.error('[CRM Activities] WhatsApp start error:', err);
    res.status(500).json({ error: 'Failed to start WhatsApp session' });
  }
});

/**
 * POST /api/crm/activities/analyze
 * AI Analysis for screenshots or text
 */
router.post('/analyze', upload.array('screenshots'), async (req: AuthRequest, res: Response) => {
  try {
    const { lead_id, pasted_text, agent_notes, activity_type } = req.body;
    const screenshots = req.files as Express.Multer.File[];

    // 1. Fetch Lead context for AI
    const leadRes = await query(
      `SELECT name, segment, trait, vip_level, risk_status, favourite_game, last_deposit_ugx, analysis_notes
       FROM leads WHERE id = $1`,
      [lead_id]
    );
    const lead = leadRes.rows[0];

    // 2. Prepare AI Prompt
    let prompt = `Analyze this client interaction for BangBet CRM.
    
    CLIENT PROFILE:
    - Name: ${lead?.name || 'Unknown'}
    - VIP: ${lead?.vip_level || 'Normal'}
    - Risk: ${lead?.risk_status || 'Stable'}
    - Segment: ${lead?.segment} / ${lead?.trait}
    - Notes: ${lead?.analysis_notes}
    
    INTERACTION DATA:
    - Activity: ${activity_type}
    - Pasted Text: ${pasted_text || 'None'}
    - Agent Notes: ${agent_notes || 'None'}
    `;

    // 3. Call OpenAI
    // Note: If screenshots exist, we'd use GPT-4o with vision. 
    // For now, we'll focus on text analysis or a simplified vision call.
    
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: 'You are a CRM AI Assistant. Analyze the provided interaction and return structured JSON.' },
      { role: 'user', content: prompt }
    ];

    if (screenshots && screenshots.length > 0) {
      // Vision logic would go here
      // For MVP, we describe that we have screenshots
      prompt += `\n(Agent has also uploaded ${screenshots.length} screenshots of the WhatsApp chat.)`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || '{}');

    res.json(aiResponse);
  } catch (err) {
    console.error('[CRM AI] Analysis error:', err);
    res.status(500).json({ error: 'AI Analysis failed' });
  }
});

export default router;
