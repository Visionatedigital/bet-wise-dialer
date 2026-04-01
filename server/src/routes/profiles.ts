import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);

// GET /profiles/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT p.*, r.role FROM profiles p
       LEFT JOIN user_roles r ON r.user_id = p.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch profile' }); }
});

// PATCH /profiles/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { full_name, avatar_url, status, manager_id, current_call_start } = req.body;
    const result = await query(
      `UPDATE profiles SET
        full_name = COALESCE($1, full_name),
        avatar_url = COALESCE($2, avatar_url),
        status = COALESCE($3, status),
        manager_id = COALESCE($4, manager_id),
        current_call_start = $5,
        last_status_change = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE last_status_change END,
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [full_name, avatar_url, status, manager_id, current_call_start, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update profile' }); }
});

// GET /profiles (all agents - admin only)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT p.*, r.role FROM profiles p
       LEFT JOIN user_roles r ON r.user_id = p.id
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch profiles' }); }
});

export default router;
