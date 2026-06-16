import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);

// GET /call-activities
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { user_id, campaign_id, start_date, end_date, limit = 100, offset = 0 } = req.query;
    const role = req.user!.role;
    const isAdmin = role === 'admin' || role === 'moderator';
    const isManagement = role === 'management';

    let sql = 'SELECT ca.*, p.full_name as agent_name FROM call_activities ca LEFT JOIN profiles p ON p.id = ca.user_id WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (!isAdmin && !isManagement) {
      sql += ` AND ca.user_id = $${paramCount++}`;
      params.push(req.user!.id);
    } else if (isManagement) {
      sql += ` AND ca.user_id IN (SELECT id FROM profiles WHERE country = (SELECT country FROM profiles WHERE id = $${paramCount++}))`;
      params.push(req.user!.id);
      if (user_id) {
        sql += ` AND ca.user_id = $${paramCount++}`;
        params.push(user_id);
      }
    } else if (user_id) {
      sql += ` AND ca.user_id = $${paramCount++}`;
      params.push(user_id);
    }

    if (campaign_id) {
      sql += ` AND ca.campaign_id = $${paramCount++}`;
      params.push(campaign_id);
    }

    if (start_date) {
      sql += ` AND ca.created_at >= $${paramCount++}`;
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ` AND ca.created_at <= $${paramCount++}`;
      params.push(end_date);
    }

    sql += ` ORDER BY ca.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(Number(limit), Number(offset));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch call activities' }); }
});

// POST /call-activities
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { phone_number, lead_name, call_type = 'dialer', status, duration_seconds = 0, deposit_amount = null, notes = null, campaign_id = null } = req.body;
    
    // Insert call activity
    const result = await query(
      `INSERT INTO call_activities (user_id, phone_number, lead_name, call_type, status, duration_seconds, deposit_amount, notes, campaign_id, end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *`,
      [req.user!.id, phone_number, lead_name, call_type, status, duration_seconds, deposit_amount, notes, campaign_id]
    );

    // Update daily metrics
    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
    const ANSWERED_STATUSES = ['interested', 'not_interested', 'answered_no_response', 'connected'];
    const isConnect = duration_seconds > 0 || ANSWERED_STATUSES.includes(status);
    const isConversion = deposit_amount !== null && deposit_amount > 0;

    await query(
      `INSERT INTO daily_metrics (user_id, date, calls_made, connects, conversions, total_handle_time_seconds, total_deposit_value)
       VALUES ($1, $2, 1, $3, $4, $5, $6)
       ON CONFLICT (user_id, date) DO UPDATE SET
         calls_made = daily_metrics.calls_made + 1,
         connects = daily_metrics.connects + EXCLUDED.connects,
         conversions = daily_metrics.conversions + EXCLUDED.conversions,
         total_handle_time_seconds = daily_metrics.total_handle_time_seconds + EXCLUDED.total_handle_time_seconds,
         total_deposit_value = daily_metrics.total_deposit_value + EXCLUDED.total_deposit_value`,
      [req.user!.id, dateStr, isConnect ? 1 : 0, isConversion ? 1 : 0, duration_seconds, deposit_amount || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to log call' }); }
});

// PATCH /call-activities/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const fields = req.body;
    const setClauses = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = Object.values(fields);
    const result = await query(
      `UPDATE call_activities SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update call activity' }); }
});


export default router;
