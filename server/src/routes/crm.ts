import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, requireAdminOrCrm, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);

// GET /crm/contacts - List contacts assigned to the agent
router.get('/contacts', async (req: AuthRequest, res: Response) => {
  try {
    const { filter = 'all', limit = 100, offset = 0 } = req.query;
    const agentId = req.user!.id;
    const role = req.user!.role;
    const isAdmin = role === 'admin' || role === 'moderator';
    const isManagement = role === 'management';

    let sql = `SELECT * FROM leads WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 1;

    // Filter by assigned agent unless admin or management
    if (!isAdmin && !isManagement) {
      sql += ` AND (user_id = $${paramCount} OR crm_owner_id = $${paramCount})`;
      params.push(agentId);
      paramCount++;
    } else if (isManagement) {
      sql += ` AND country = (SELECT country FROM profiles WHERE id = $${paramCount})`;
      params.push(agentId);
      paramCount++;
    }

    // Apply specific CRM filters
    switch (filter) {
      case 'vip':
        sql += ` AND (vip_level IS NOT NULL OR segment = 'vip')`;
        break;
      case 'hot':
        sql += ` AND (priority = 'high' OR lead_score > 80)`;
        break;
      case 'at_risk':
        sql += ` AND risk_status = 'At Risk'`;
        break;
      case 'needs_follow_up':
        sql += ` AND (next_action IS NOT NULL OR cooldown_until <= NOW())`;
        break;
      case 'no_response':
        sql += ` AND lifecycle_stage = 'called' AND last_activity = 'No Answer'`;
        break;
      case 'converted':
        sql += ` AND lifecycle_stage = 'converted'`;
        break;
      case 'escalations':
        sql += ` AND risk_status = 'Escalated'`;
        break;
    }

    sql += ` ORDER BY COALESCE(crm_priority, 0) DESC, created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(Number(limit), Number(offset));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[CRM] Fetch contacts error:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET /crm/contacts/:id/timeline - Fetch interaction history
router.get('/contacts/:id/timeline', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT * FROM contact_timeline WHERE contact_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[CRM] Fetch timeline error:', err);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// POST /crm/calls - Log a CRM call outcome
router.post('/calls', async (req: AuthRequest, res: Response) => {
  try {
    const {
      contact_id,
      phone_number,
      call_outcome,
      client_mood,
      reason_for_contact,
      result,
      next_action,
      notes
    } = req.body;
    const agent_id = req.user!.id;

    // 1. Insert into call_logs
    const logResult = await query(
      `INSERT INTO call_logs (
        contact_id, agent_id, phone_number, call_outcome, client_mood, 
        reason_for_contact, result, next_action, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [contact_id, agent_id, phone_number, call_outcome, client_mood, reason_for_contact, result, next_action, notes]
    );

    // 2. Add to contact_timeline
    await query(
      `INSERT INTO contact_timeline (
        contact_id, agent_id, event_type, title, summary, outcome, next_action
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        contact_id, 
        agent_id, 
        'call', 
        'Call Logged', 
        `Call outcome: ${call_outcome}. Reason: ${reason_for_contact}`, 
        result, 
        next_action
      ]
    );

    // 3. Update lead status/next action
    await query(
      `UPDATE leads SET 
        last_crm_contact_at = NOW(),
        next_action = $1,
        status = $2,
        updated_at = NOW()
      WHERE id = $3`,
      [next_action, result, contact_id]
    );

    // 4. Log agent activity
    await query(
      `INSERT INTO agent_activity (agent_id, contact_id, activity_type, result)
       VALUES ($1, $2, $3, $4)`,
      [agent_id, contact_id, 'call', result]
    );

    res.json({ message: 'Call logged successfully', id: logResult.rows[0].id });
  } catch (err) {
    console.error('[CRM] Log call error:', err);
    res.status(500).json({ error: 'Failed to log call' });
  }
});

export default router;
