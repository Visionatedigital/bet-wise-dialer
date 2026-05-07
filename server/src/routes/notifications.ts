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

// GET /notifications/intelligent - AI-driven monitoring
router.get('/intelligent', async (req: AuthRequest, res: Response) => {
  try {
    const alerts: any[] = [];
    
    // 1. VIP Follow-up Monitor (No contact in 48h)
    const vipFollowUps = await query(`
      SELECT id, name, phone, last_contact_at 
      FROM leads 
      WHERE user_id = $1 
      AND segment = 'vip' 
      AND (last_contact_at < NOW() - INTERVAL '48 hours' OR last_contact_at IS NULL)
      LIMIT 5
    `, [req.user!.id]);

    vipFollowUps.rows.forEach(lead => {
      alerts.push({
        id: `ai-vip-${lead.id}`,
        type: 'follow_up',
        title: 'VIP High Priority',
        message: `${lead.name} needs a follow-up. Last contacted ${lead.last_contact_at ? new Date(lead.last_contact_at).toLocaleDateString() : 'never'}.`,
        created_at: new Date().toISOString(),
        is_ai: true,
        metadata: { lead_id: lead.id }
      });
    });

    // 2. High Value Dormancy (High score, no recent activity)
    const highValueDormant = await query(`
      SELECT id, name, score 
      FROM leads 
      WHERE user_id = $1 
      AND score > 80 
      AND (last_contact_at < NOW() - INTERVAL '7 days' OR last_contact_at IS NULL)
      LIMIT 3
    `, [req.user!.id]);

    highValueDormant.rows.forEach(lead => {
      alerts.push({
        id: `ai-dormant-${lead.id}`,
        type: 'follow_up',
        title: 'Dormant High Value',
        message: `${lead.name} (Score ${lead.score}) has been inactive for 7 days. Suggest re-engagement.`,
        created_at: new Date().toISOString(),
        is_ai: true,
        metadata: { lead_id: lead.id }
      });
    });

    // 3. (Mock) WhatsApp Reply Monitor
    // In a real system, we'd check a whatsapp_messages table for 'unread' or 'reply' status
    alerts.push({
      id: 'ai-wa-mock',
      type: 'whatsapp',
      title: 'WhatsApp Reply',
      message: 'New message from Client 66830: "How do I claim the VIP bonus?"',
      created_at: new Date(Date.now() - 1800000).toISOString(),
      is_ai: true
    });

    res.json(alerts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate intelligent alerts' });
  }
});

export default router;
