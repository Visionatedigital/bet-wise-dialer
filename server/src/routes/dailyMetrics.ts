import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);

// GET /daily-metrics
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user!.role;
    const isAdmin = role === 'admin' || role === 'moderator';
    const isManagement = role === 'management';
    const { user_id, date, start_date, end_date } = req.query;

    let sql = 'SELECT * FROM daily_metrics WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (!isAdmin && !isManagement) {
      sql += ` AND user_id = $${paramCount++}`;
      params.push(req.user!.id);
    } else if (isManagement) {
      sql += ` AND user_id IN (SELECT id FROM profiles WHERE country = (SELECT country FROM profiles WHERE id = $${paramCount++}))`;
      params.push(req.user!.id);
      if (user_id) {
        sql += ` AND user_id = $${paramCount++}`;
        params.push(user_id);
      }
    } else if (user_id) {
      sql += ` AND user_id = $${paramCount++}`;
      params.push(user_id);
    }

    if (date) {
      sql += ` AND date = $${paramCount++}`;
      params.push(date);
    } else if (start_date && end_date) {
      sql += ` AND date >= $${paramCount++} AND date <= $${paramCount++}`;
      params.push(start_date, end_date);
    }

    sql += ` ORDER BY date DESC, user_id`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch daily metrics' }); }
});

export default router;
