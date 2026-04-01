import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);

// GET /callbacks
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = ['admin', 'management', 'moderator'].includes(req.user!.role);
    const { status, limit = 100 } = req.query;

    let sql = 'SELECT * FROM callbacks WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (!isAdmin) {
      sql += ` AND user_id = $${paramCount++}`;
      params.push(req.user!.id);
    }
    
    if (status) {
      sql += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    sql += ` ORDER BY scheduled_for ASC LIMIT $${paramCount++}`;
    params.push(Number(limit));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch callbacks' }); }
});

// POST /callbacks
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { lead_name, phone_number, notes, scheduled_for } = req.body;
    const result = await query(
      `INSERT INTO callbacks (user_id, lead_name, phone_number, notes, scheduled_for, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [req.user!.id, lead_name, phone_number, notes, scheduled_for]
    );
    
    // Also update daily metrics for callbacks due today if applicable
    // (This is a simplified approach; could check if scheduled_for is today)
    
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to schedule callback' }); }
});

// PATCH /callbacks/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { status, notes } = req.body;
    let sql = 'UPDATE callbacks SET updated_at = NOW()';
    const params: any[] = [req.params.id];
    let paramCount = 2;

    if (status) {
      sql += `, status = $${paramCount++}`;
      params.push(status);
    }
    if (notes) {
      sql += `, notes = $${paramCount++}`;
      params.push(notes);
    }
    sql += ` WHERE id = $1 RETURNING *`;

    const result = await query(sql, params);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update callback' }); }
});

export default router;
