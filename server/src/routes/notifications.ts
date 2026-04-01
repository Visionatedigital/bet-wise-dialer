import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);

// GET /notifications
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const result = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.user!.id, Number(limit)]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch notifications' }); }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user!.id]
    );
    res.json(result.rows[0] || { message: 'Notification not found' });
  } catch (err) { res.status(500).json({ error: 'Failed to mark notification rad' }); }
});

// PATCH /notifications/read-all
router.patch('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await query('UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE', [req.user!.id]);
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ error: 'Failed to mark all as read' }); }
});

export default router;
