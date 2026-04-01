import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate as any);
router.use(requireAdmin as any);

// GET /reports/admin
router.get('/admin', async (req: AuthRequest, res: Response) => {
  try {
    const { start_date } = req.query;

    const usersRes = await query('SELECT COUNT(*) FROM users');
    const profilesRes = await query("SELECT COUNT(*) FROM profiles WHERE status = 'online'");
    const rolesRes = await query("SELECT COUNT(*) FROM user_roles WHERE role = 'agent'");
    const leadsRes = await query('SELECT COUNT(*) FROM leads');
    
    // Calls total and recent
    const callsTotalRes = await query('SELECT COUNT(*) FROM call_activities');
    let callsRecentRes = callsTotalRes;
    let callsByStatusRes: any = { rows: [] };
    
    if (start_date) {
      callsRecentRes = await query('SELECT COUNT(*) FROM call_activities WHERE start_time >= $1', [start_date]);
      callsByStatusRes = await query('SELECT status, COUNT(*) as count FROM call_activities WHERE start_time >= $1 GROUP BY status', [start_date]);
    } else {
      callsByStatusRes = await query('SELECT status, COUNT(*) as count FROM call_activities GROUP BY status');
    }

    const leadsSegmentRes = await query('SELECT segment, COUNT(*) as count FROM leads GROUP BY segment');

    const callsByStatus = { connected: 0, converted: 0, failed: 0 };
    callsByStatusRes.rows.forEach((r: any) => {
      if (r.status === 'connected') callsByStatus.connected += Number(r.count);
      else if (r.status === 'converted') callsByStatus.converted += Number(r.count);
      else callsByStatus.failed += Number(r.count);
    });

    const leadsBySegment = { vip: 0, semiActive: 0, dormant: 0 };
    leadsSegmentRes.rows.forEach((r: any) => {
      if (r.segment === 'vip') leadsBySegment.vip += Number(r.count);
      else if (r.segment === 'semi-active') leadsBySegment.semiActive += Number(r.count);
      else if (r.segment === 'dormant') leadsBySegment.dormant += Number(r.count);
    });

    res.json({
      totalUsers: Number(usersRes.rows[0].count),
      totalAgents: Number(rolesRes.rows[0].count),
      activeAgents: Number(profilesRes.rows[0].count),
      totalLeads: Number(leadsRes.rows[0].count),
      totalCalls: Number(callsTotalRes.rows[0].count),
      totalCallsThisMonth: Number(callsRecentRes.rows[0].count),
      callsByStatus,
      leadsBySegment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate admin report' });
  }
});

export default router;
