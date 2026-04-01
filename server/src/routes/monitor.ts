import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);

// GET /monitor
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = ['admin', 'management', 'moderator'].includes(req.user!.role);
    if (!isAdmin) {
        return res.status(403).json({ error: 'Admin or management access required' });
    }
    
    // Use the custom function we created in the database init script
    const result = await query('SELECT * FROM get_agent_monitor_data()');
    res.json(result.rows);
  } catch (err) { 
    console.error('[Monitor] Error:', err);
    res.status(500).json({ error: 'Failed to fetch monitor data' }); 
  }
});

export default router;
