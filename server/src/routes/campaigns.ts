import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);

// GET /campaigns
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM campaigns ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch campaigns' }); }
});

// POST /campaigns
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, target_segment, target_calls = null, target_conversions = null, ai_script = null } = req.body;
    const result = await query(
      `INSERT INTO campaigns (user_id, name, description, target_segment, target_calls, target_conversions, ai_script)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user!.id, name, description, target_segment, target_calls, target_conversions, ai_script]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to create campaign' }); }
});

// GET /campaigns/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch campaign' }); }
});

// PATCH /campaigns/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const fields = req.body;
    const setClauses = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = Object.values(fields);
    const result = await query(
      `UPDATE campaigns SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update campaign' }); }
});

// DELETE /campaigns/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    res.json({ message: 'Campaign deleted' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete campaign' }); }
});

export default router;
