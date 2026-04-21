import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);

// GET /users - list all users (admin sees all; management sees own country only)
router.get('/', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    let sql = `SELECT u.id, u.email, u.created_at, p.full_name, p.approved, p.rejected, p.status, p.country,
                      array_agg(r.role) FILTER (WHERE r.role IS NOT NULL) as roles
               FROM users u
               LEFT JOIN profiles p ON p.id = u.id
               LEFT JOIN user_roles r ON r.user_id = u.id`;
    const params: any[] = [];

    if (isManagement) {
      // Managers only see users from their own country
      sql += ` WHERE p.country = (SELECT country FROM profiles WHERE id = $1)`;
      params.push(req.user!.id);
    }

    sql += ` GROUP BY u.id, u.email, u.created_at, p.full_name, p.approved, p.rejected, p.status, p.country ORDER BY u.created_at DESC`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch users' }); }
});

// PATCH /users/:id/approve
router.patch('/:id/approve', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    if (isManagement) {
      // Managers can only approve users from their own country
      const check = await query(
        `SELECT p.id FROM profiles p
         WHERE p.id = $1
         AND p.country = (SELECT country FROM profiles WHERE id = $2)`,
        [req.params.id, req.user!.id]
      );
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'Cannot approve users outside your country' });
      }
    }
    await query('UPDATE profiles SET approved = $1, updated_at = NOW() WHERE id = $2', [req.body.approved, req.params.id]);
    res.json({ message: 'User approval updated' });
  } catch (err) { res.status(500).json({ error: 'Failed to update approval' }); }
});

// PATCH /users/:id/reject
router.patch('/:id/reject', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    if (isManagement) {
      const check = await query(
        `SELECT p.id FROM profiles p
         WHERE p.id = $1
         AND p.country = (SELECT country FROM profiles WHERE id = $2)`,
        [req.params.id, req.user!.id]
      );
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'Cannot reject users outside your country' });
      }
    }
    await query(
      'UPDATE profiles SET rejected = TRUE, approved = FALSE, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'User rejected' });
  } catch (err) { res.status(500).json({ error: 'Failed to reject user' }); }
});

// PATCH /users/:id/role
router.patch('/:id/role', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    await query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
      [req.params.id, role]
    );
    res.json({ message: 'Role assigned' });
  } catch (err) { res.status(500).json({ error: 'Failed to assign role' }); }
});

// POST /users/:id/reset-password
router.post('/:id/reset-password', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    if (isManagement) {
      const check = await query(
        `SELECT id FROM profiles WHERE id = $1 AND country = (SELECT country FROM profiles WHERE id = $2)`,
        [req.params.id, req.user!.id]
      );
      if (check.rows.length === 0) return res.status(403).json({ error: 'Cannot reset password for users outside your country' });
    }
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.params.id]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) { res.status(500).json({ error: 'Failed to reset password' }); }
});

// POST /users/bulk-create - create multiple agent accounts at once (admin)
// Used to migrate existing agents from Supabase or seed test accounts
router.post('/bulk-create', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { agents, default_password = 'BangBet2026!' } = req.body;
    // agents: [{ email, full_name, password?, role? }]
    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({ error: 'Provide an array of agents: [{ email, full_name, password?, role? }]' });
    }

    const results: { email: string; status: string; id?: string }[] = [];

    for (const agent of agents) {
      const email = (agent.email || '').toLowerCase().trim();
      const fullName = agent.full_name || agent.name || email.split('@')[0];
      const password = agent.password || default_password;
      const role = agent.role || 'agent';

      if (!email) {
        results.push({ email: agent.email || '(empty)', status: 'skipped - no email' });
        continue;
      }

      // Check if exists
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        results.push({ email, status: 'already exists', id: existing.rows[0].id });
        continue;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const userResult = await query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        [email, passwordHash]
      );
      const userId = userResult.rows[0].id;

      // Create profile (pre-approved)
      await query(
        'INSERT INTO profiles (id, email, full_name, approved) VALUES ($1, $2, $3, TRUE)',
        [userId, email, fullName]
      );

      // Assign role
      await query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
        [userId, role]
      );

      results.push({ email, status: 'created', id: userId });
    }

    const created = results.filter(r => r.status === 'created').length;
    const skipped = results.filter(r => r.status === 'already exists').length;

    res.status(201).json({
      message: `Created ${created} agents, ${skipped} already existed`,
      results,
    });
  } catch (err: any) {
    console.error('[Users] Bulk create error:', err);
    res.status(500).json({ error: 'Failed to bulk create agents' });
  }
});

// DELETE /users/:id
router.delete('/:id', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    if (isManagement) {
      const check = await query(
        `SELECT id FROM profiles WHERE id = $1 AND country = (SELECT country FROM profiles WHERE id = $2)`,
        [req.params.id, req.user!.id]
      );
      if (check.rows.length === 0) return res.status(403).json({ error: 'Cannot delete users outside your country' });
    }
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete user' }); }
});

export default router;
