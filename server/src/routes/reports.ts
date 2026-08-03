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

// GET /reports/daily-call-notes?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// Returns every lead worked on the given date range by any agent in the manager's country.
// Response shape: { total, rows: [{ date, agent_name, phone, remarks }] }
// The "remarks" value is the lead's last_activity disposition (or call notes if present).
router.get('/daily-call-notes', async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    const managerId = req.user!.id;

    const startDateParam = (req.query.start_date as string) || (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const endDateParam = (req.query.end_date as string) || (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const params: any[] = [startDateParam, endDateParam];
    let countryClause = '';
    if (isManagement) {
      params.push(managerId);
      countryClause = `AND p.country = (SELECT country FROM profiles WHERE id = $${params.length})`;
    }

    // Primary source: call_activities (has agent, phone, notes, timestamp)
    const caResult = await query(
      `SELECT
         (ca.created_at AT TIME ZONE 'Africa/Kampala')::date::text AS local_date,
         ca.created_at          AS call_date,
         p.full_name            AS agent_name,
         COALESCE(ca.phone_number, l.phone, '') AS phone,
         COALESCE(ca.notes, l.last_activity, ca.status, '') AS remarks,
         l.name                 AS lead_name
       FROM call_activities ca
       JOIN profiles p ON p.id = ca.user_id
       LEFT JOIN leads l ON l.phone = ca.phone_number
       WHERE (ca.created_at AT TIME ZONE 'Africa/Kampala')::date >= $1::date
         AND (ca.created_at AT TIME ZONE 'Africa/Kampala')::date <= $2::date
         AND (l.id IS NULL OR l.crm_owner_id IS NULL)
         ${countryClause}
       ORDER BY p.full_name ASC, ca.created_at ASC`,
      params
    );

    // Also pull leads that were updated/touched today (last_contact_at) but may not have
    // a call_activity row (e.g. status set via the kanban card).
    const params2: any[] = [startDateParam, endDateParam];
    let countryClause2 = '';
    if (isManagement) {
      params2.push(managerId);
      countryClause2 = `AND l.country = (SELECT country FROM profiles WHERE id = $${params2.length})`;
    }

    const leadsResult = await query(
      `SELECT
         (l.last_contact_at AT TIME ZONE 'Africa/Kampala')::date::text AS local_date,
         l.last_contact_at      AS call_date,
         p.full_name            AS agent_name,
         l.phone                AS phone,
         COALESCE(l.last_activity, l.status, '') AS remarks,
         l.name                 AS lead_name
       FROM leads l
       JOIN profiles p ON p.id = l.user_id
       WHERE (l.last_contact_at AT TIME ZONE 'Africa/Kampala')::date >= $1::date
         AND (l.last_contact_at AT TIME ZONE 'Africa/Kampala')::date <= $2::date
         AND l.crm_owner_id IS NULL
         ${countryClause2}
       ORDER BY p.full_name ASC, l.last_contact_at ASC`,
      params2
    );

    // Merge: dedupe by (agent_name + phone + local_date) — prefer call_activity row if both exist
    const seen = new Set<string>();
    const rows: any[] = [];

    for (const r of caResult.rows) {
      const key = `${r.agent_name}|${r.phone}|${r.local_date}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(r);
      }
    }
    for (const r of leadsResult.rows) {
      const key = `${r.agent_name}|${r.phone}|${r.local_date}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(r);
      }
    }

    // Sort final merged set by date, then agent_name
    rows.sort((a, b) => {
      const dateComp = String(b.local_date || '').localeCompare(String(a.local_date || ''));
      if (dateComp !== 0) return dateComp;
      const nameComp = String(a.agent_name || '').localeCompare(String(b.agent_name || ''));
      if (nameComp !== 0) return nameComp;
      return new Date(a.call_date).getTime() - new Date(b.call_date).getTime();
    });

    res.json({
      start_date: startDateParam,
      end_date: endDateParam,
      total: rows.length,
      rows: rows.map(r => ({
        date: r.local_date,
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


// GET /reports/deposit-analytics
// Overall deposit performance: total deposits, top numbers, top agents.
// Scoped to manager's country for management role.
router.get('/deposit-analytics', async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    const managerId = req.user!.id;
    const cSub = `(SELECT country FROM profiles WHERE id = $1)`;
    const params = isManagement ? [managerId] : [];
    const countryFilter = isManagement ? `AND l.country = ${cSub}` : '';
    const countryFilterCA = isManagement ? `AND p.country = ${cSub}` : '';

    // 1. Overall deposit totals
    const totalsRes = await query(
      `SELECT
        COALESCE(SUM(COALESCE(l.lifetime_value, l.last_deposit_ugx, 0)), 0) AS total_deposited_ugx,
        COALESCE(SUM(COALESCE(l.attributed_deposit_ugx, 0)), 0)             AS attributed_ugx,
        COUNT(l.id) FILTER (WHERE l.lifecycle_stage = 'converted')           AS converted_count,
        COUNT(l.id) FILTER (WHERE COALESCE(l.lifetime_value, l.last_deposit_ugx, 0) > 0) AS depositors_count,
        COUNT(l.id)                                                          AS total_leads
       FROM leads l
       WHERE 1=1 ${countryFilter}`,
      params
    );

    // 2. Top 10 depositing phone numbers (ever)
    const topLeadsRes = await query(
      `SELECT
        l.phone,
        l.name,
        l.trait,
        l.lifecycle_stage,
        COALESCE(l.lifetime_value, l.last_deposit_ugx, 0) AS deposited_ugx,
        COALESCE(l.attributed_deposit_ugx, 0)             AS attributed_ugx,
        p.full_name AS assigned_agent
       FROM leads l
       LEFT JOIN profiles p ON p.id = l.user_id
       WHERE COALESCE(l.lifetime_value, l.last_deposit_ugx, 0) > 0
         ${countryFilter}
       ORDER BY COALESCE(l.lifetime_value, l.last_deposit_ugx, 0) DESC
       LIMIT 10`,
      params
    );

    // 3. Top agents by total deposited value of their assigned leads
    const topAgentsRes = await query(
      `SELECT
        p.id,
        p.full_name,
        p.email,
        COUNT(l.id)                                                              AS total_leads,
        COUNT(l.id) FILTER (WHERE l.lifecycle_stage = 'converted')               AS conversions,
        COALESCE(SUM(COALESCE(l.attributed_deposit_ugx, 0)), 0)                  AS attributed_ugx,
        COALESCE(SUM(COALESCE(l.lifetime_value, l.last_deposit_ugx, 0)), 0)      AS total_deposited_ugx
       FROM profiles p
       JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'agent'
       LEFT JOIN leads l ON l.user_id = p.id
       WHERE 1=1 ${countryFilterCA.replace('l.country', 'p.country').replace('AND p.country', 'AND p.country')}
       GROUP BY p.id, p.full_name, p.email
       ORDER BY attributed_ugx DESC
       LIMIT 10`,
      params
    );

    // 4. Monthly trend (last 6 months)
    const trendRes = await query(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', ib.created_at), 'YYYY-MM') AS month,
        COUNT(DISTINCT ib.id) AS refreshes,
        COALESCE(SUM(ib.attributed_deposit_ugx), 0) AS attributed_ugx
       FROM import_batches ib
       WHERE ib.batch_type = 'performance_refresh'
         AND ib.created_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', ib.created_at)
       ORDER BY month ASC`,
      []
    );

    const totals = totalsRes.rows[0];
    res.json({
      totals: {
        total_deposited_ugx: Number(totals.total_deposited_ugx),
        attributed_ugx: Number(totals.attributed_ugx),
        converted_count: Number(totals.converted_count),
        depositors_count: Number(totals.depositors_count),
        total_leads: Number(totals.total_leads),
      },
      top_leads: topLeadsRes.rows.map(r => ({
        ...r,
        deposited_ugx: Number(r.deposited_ugx),
        attributed_ugx: Number(r.attributed_ugx),
      })),
      top_agents: topAgentsRes.rows.map(r => ({
        ...r,
        total_leads: Number(r.total_leads),
        conversions: Number(r.conversions),
        attributed_ugx: Number(r.attributed_ugx),
        total_deposited_ugx: Number(r.total_deposited_ugx),
      })),
      monthly_trend: trendRes.rows.map(r => ({
        month: r.month,
        refreshes: Number(r.refreshes),
        attributed_ugx: Number(r.attributed_ugx),
      })),
    });
  } catch (err) {
    console.error('[Reports] deposit-analytics error:', err);
    res.status(500).json({ error: 'Failed to generate deposit analytics' });
  }
});

export default router;
