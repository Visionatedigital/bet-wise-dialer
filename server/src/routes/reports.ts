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
    const isManagement = req.user!.role === 'management';
    const managerId = req.user!.id;

    // Country subquery used in parameterized queries
    const cSub = `(SELECT country FROM profiles WHERE id = $1)`;

    const [usersRes, profilesRes, rolesRes, leadsRes, callsTotalRes] = await Promise.all([
      isManagement
        ? query(`SELECT COUNT(*) FROM profiles WHERE country = ${cSub}`, [managerId])
        : query('SELECT COUNT(*) FROM users'),
      isManagement
        ? query(`SELECT COUNT(*) FROM profiles WHERE country = ${cSub} AND status = 'online'`, [managerId])
        : query("SELECT COUNT(*) FROM profiles WHERE status = 'online'"),
      isManagement
        ? query(`SELECT COUNT(*) FROM user_roles ur JOIN profiles p ON p.id = ur.user_id WHERE ur.role = 'agent' AND p.country = ${cSub}`, [managerId])
        : query("SELECT COUNT(*) FROM user_roles WHERE role = 'agent'"),
      isManagement
        ? query(`SELECT COUNT(*) FROM leads WHERE country = ${cSub} AND crm_owner_id IS NULL`, [managerId])
        : query('SELECT COUNT(*) FROM leads WHERE crm_owner_id IS NULL'),
      isManagement
        ? query(`SELECT COUNT(*) FROM call_activities ca JOIN profiles p ON p.id = ca.user_id LEFT JOIN leads l ON l.phone = ca.phone_number WHERE p.country = ${cSub} AND (l.id IS NULL OR l.crm_owner_id IS NULL)`, [managerId])
        : query('SELECT COUNT(*) FROM call_activities ca LEFT JOIN leads l ON l.phone = ca.phone_number WHERE (l.id IS NULL OR l.crm_owner_id IS NULL)'),
    ]);

    let callsRecentRes = callsTotalRes;
    let callsByStatusRes: any = { rows: [] };

    if (start_date) {
      [callsRecentRes, callsByStatusRes] = await Promise.all([
        isManagement
          ? query(`SELECT COUNT(*) FROM call_activities ca JOIN profiles p ON p.id = ca.user_id WHERE p.country = ${cSub} AND ca.start_time >= $2`, [managerId, start_date])
          : query('SELECT COUNT(*) FROM call_activities WHERE start_time >= $1', [start_date]),
        isManagement
          ? query(`SELECT ca.status, COUNT(*) as count FROM call_activities ca JOIN profiles p ON p.id = ca.user_id WHERE p.country = ${cSub} AND ca.start_time >= $2 GROUP BY ca.status`, [managerId, start_date])
          : query('SELECT status, COUNT(*) as count FROM call_activities WHERE start_time >= $1 GROUP BY status', [start_date]),
      ]);
    } else {
      callsByStatusRes = isManagement
        ? await query(`SELECT ca.status, COUNT(*) as count FROM call_activities ca JOIN profiles p ON p.id = ca.user_id WHERE p.country = ${cSub} GROUP BY ca.status`, [managerId])
        : await query('SELECT status, COUNT(*) as count FROM call_activities GROUP BY status');
    }

    const leadsSegmentRes = isManagement
      ? await query(`SELECT segment, COUNT(*) as count FROM leads WHERE country = ${cSub} AND crm_owner_id IS NULL GROUP BY segment`, [managerId])
      : await query('SELECT segment, COUNT(*) as count FROM leads WHERE crm_owner_id IS NULL GROUP BY segment');

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

// GET /reports/daily-call-notes?date=YYYY-MM-DD
// Returns every lead worked on the given date by any agent in the manager's country.
// Response shape: { date, rows: [{ date, agent_name, phone, remarks }] }
// The "remarks" value is the lead's last_activity disposition (or call notes if present).
router.get('/daily-call-notes', async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    const managerId = req.user!.id;

    // Default to today if no date provided
    const dateParam = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    // Build date-range bounds (start of day → end of day UTC)
    const dayStart = `${dateParam}T00:00:00.000Z`;
    const dayEnd   = `${dateParam}T23:59:59.999Z`;

    // Pull all call_activities for the day, joined with lead data and agent profile.
    // Management users are scoped to their country; admins see all.
    const params: any[] = [dayStart, dayEnd];
    let countryClause = '';
    if (isManagement) {
      params.push(managerId);
      countryClause = `AND p.country = (SELECT country FROM profiles WHERE id = $${params.length})`;
    }

    // Primary source: call_activities (has agent, phone, notes, timestamp)
    const caResult = await query(
      `SELECT
         ca.created_at          AS call_date,
         p.full_name            AS agent_name,
         COALESCE(ca.phone_number, l.phone, '') AS phone,
         COALESCE(ca.notes, l.last_activity, ca.status, '') AS remarks,
         l.name                 AS lead_name
       FROM call_activities ca
       JOIN profiles p ON p.id = ca.user_id
       LEFT JOIN leads l ON l.phone = ca.phone_number
       WHERE ca.created_at BETWEEN $1 AND $2
         AND (l.id IS NULL OR l.crm_owner_id IS NULL)
         ${countryClause}
       ORDER BY p.full_name ASC, ca.created_at ASC`,
      params
    );

    // Also pull leads that were updated/touched today (last_contact_at) but may not have
    // a call_activity row (e.g. status set via the kanban card).
    const params2: any[] = [dayStart, dayEnd];
    let countryClause2 = '';
    if (isManagement) {
      params2.push(managerId);
      countryClause2 = `AND l.country = (SELECT country FROM profiles WHERE id = $${params2.length})`;
    }

    const leadsResult = await query(
      `SELECT
         l.last_contact_at      AS call_date,
         p.full_name            AS agent_name,
         l.phone                AS phone,
         COALESCE(l.last_activity, l.status, '') AS remarks,
         l.name                 AS lead_name
       FROM leads l
       JOIN profiles p ON p.id = l.user_id
       WHERE l.last_contact_at BETWEEN $1 AND $2
         AND l.crm_owner_id IS NULL
         ${countryClause2}
       ORDER BY p.full_name ASC, l.last_contact_at ASC`,
      params2
    );

    // Merge: dedupe by (agent_name + phone) — prefer call_activity row if both exist
    const seen = new Set<string>();
    const rows: any[] = [];

    for (const r of caResult.rows) {
      const key = `${r.agent_name}|${r.phone}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(r);
      }
    }
    for (const r of leadsResult.rows) {
      const key = `${r.agent_name}|${r.phone}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(r);
      }
    }

    // Sort final merged set by agent_name then call_date
    rows.sort((a, b) => {
      const nameComp = String(a.agent_name || '').localeCompare(String(b.agent_name || ''));
      if (nameComp !== 0) return nameComp;
      return new Date(a.call_date).getTime() - new Date(b.call_date).getTime();
    });

    res.json({
      date: dateParam,
      total: rows.length,
      rows: rows.map(r => ({
        date: dateParam,
        agent_name: r.agent_name || '',
        phone: r.phone || '',
        remarks: r.remarks || '',
      })),
    });
  } catch (err) {
    console.error('[Reports] daily-call-notes error:', err);
    res.status(500).json({ error: 'Failed to generate daily call notes report' });
  }
});

export default router;

