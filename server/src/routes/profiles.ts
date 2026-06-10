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
    // Users may only update their own profile (admins can update any)
    const isAdmin = ['admin', 'moderator'].includes(req.user!.role);
    if (!isAdmin && req.user!.id !== req.params.id) {
      return res.status(403).json({ error: 'Cannot update another user\'s profile' });
    }

    const { full_name, avatar_url, status, manager_id, current_call_start, email, country } = req.body;

    // Validate country if provided
    const validCountries = ['UG', 'GH', 'NG', 'TZ', 'KE'];
    const safeCountry = country && validCountries.includes(country) ? country : undefined;

    // Update email in users table if provided
    if (email) {
      const emailLower = email.toLowerCase().trim();
      const existing = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [emailLower, req.params.id]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      await query('UPDATE users SET email = $1 WHERE id = $2', [emailLower, req.params.id]);
    }

    const result = await query(
      `UPDATE profiles SET
        full_name = COALESCE($1, full_name),
        avatar_url = CASE WHEN $8 THEN $2 ELSE COALESCE($2, avatar_url) END,
        status = COALESCE($3, status),
        manager_id = COALESCE($4, manager_id),
        current_call_start = $5,
        country = COALESCE($7, country),
        last_status_change = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE last_status_change END,
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [full_name, avatar_url ?? null, status, manager_id, current_call_start, req.params.id, safeCountry, 'avatar_url' in req.body]
    );

    // Return merged profile with current email
    const userRow = await query('SELECT email FROM users WHERE id = $1', [req.params.id]);
    res.json({ ...result.rows[0], email: userRow.rows[0]?.email });
  } catch (err) { res.status(500).json({ error: 'Failed to update profile' }); }
});

// GET /profiles (all agents - admin only; management sees own country)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    const params: any[] = [];
    let sql = `SELECT p.*, r.role FROM profiles p LEFT JOIN user_roles r ON r.user_id = p.id`;
    if (isManagement) {
      sql += ` WHERE p.country = (SELECT country FROM profiles WHERE id = $1)`;
      params.push(req.user!.id);
    }
    sql += ` ORDER BY p.created_at DESC`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch profiles' }); }
});

export default router;
