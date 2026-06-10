import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { config } from '../config';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Response } from 'express';

const router = Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Get user
    const userResult = await query(
      'SELECT u.id, u.email, u.password_hash, p.full_name, p.approved, p.rejected, p.avatar_url, p.country FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if rejected
    if (user.rejected) {
      return res.status(403).json({ error: 'Your sign-up request was rejected. Please sign up again and select the correct country.' });
    }

    // Check if approved
    if (!user.approved) {
      return res.status(403).json({ error: 'Account pending approval. Please contact an administrator.' });
    }

    // Get role
    const roleResult = await query('SELECT role FROM user_roles WHERE user_id = $1 LIMIT 1', [user.id]);
    const role = roleResult.rows[0]?.role || 'agent';

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as any
    );

    // Update last seen (don't block on this)
    query('UPDATE profiles SET status = $1, last_status_change = NOW() WHERE id = $2', ['available', user.id]).catch(() => {});

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        role,
        country: user.country || 'UG',
      },
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, full_name, role = 'agent', country = 'UG' } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Validate country code
    const validCountries = ['UG', 'GH', 'NG', 'TZ', 'KE'];
    const safeCountry = validCountries.includes(country) ? country : 'UG';

    // Prevent self-signup as admin
    const safeRole = role === 'admin' ? 'agent' : role;

    // Check existing
    const existing = await query(
      `SELECT u.id, p.rejected FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      // Allow re-registration only if previously rejected
      if (!existingUser.rejected) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      // Re-registration: update password, country, manager, and clear rejection
      const passwordHash = await bcrypt.hash(password, 10);
      await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, existingUser.id]);

      const managerResult = await query(
        `SELECT p.id FROM profiles p
         JOIN user_roles r ON r.user_id = p.id
         WHERE r.role = 'management' AND p.country = $1
         ORDER BY p.created_at ASC LIMIT 1`,
        [safeCountry]
      );
      const managerId = managerResult.rows[0]?.id || null;

      await query(
        `UPDATE profiles SET full_name = $1, country = $2, manager_id = $3, approved = FALSE, rejected = FALSE, updated_at = NOW() WHERE id = $4`,
        [full_name || null, safeCountry, managerId, existingUser.id]
      );

      return res.status(201).json({
        message: 'Your sign-up request has been resubmitted! Your country manager will review and approve your access.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase().trim(), passwordHash]
    );
    const newUser = userResult.rows[0];

    // Look up the manager for this country
    const managerResult = await query(
      `SELECT p.id FROM profiles p
       JOIN user_roles r ON r.user_id = p.id
       WHERE r.role = 'management' AND p.country = $1
       ORDER BY p.created_at ASC LIMIT 1`,
      [safeCountry]
    );
    const managerId = managerResult.rows[0]?.id || null;

    // Create profile (not approved yet) with country + manager assignment
    await query(
      'INSERT INTO profiles (id, email, full_name, approved, rejected, country, manager_id) VALUES ($1, $2, $3, FALSE, FALSE, $4, $5)',
      [newUser.id, newUser.email, full_name || null, safeCountry, managerId]
    );

    // Assign role
    await query(
      'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [newUser.id, safeRole]
    );

    res.status(201).json({
      message: 'Account created successfully! Your account is pending approval. Your country manager will review and approve your access.',
    });
  } catch (err: any) {
    console.error('[Auth] Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Mark user as offline
    await query('UPDATE profiles SET status = $1, last_status_change = NOW() WHERE id = $2', ['offline', req.user!.id]);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.json({ message: 'Logged out' });
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, p.full_name, p.avatar_url, p.approved, p.status, p.manager_id, p.country,
              r.role
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       LEFT JOIN user_roles r ON r.user_id = u.id
       WHERE u.id = $1`,
      [req.user!.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /auth/change-password
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    const user = userResult.rows[0];

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user!.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
