import { Router, Response } from 'express';
import { pool, query } from '../db';
import { authenticate, requireAdmin, requireAdminOrCrm, AuthRequest } from '../middleware/auth';
import {
  classifyLead,
  computeCooldownUntil,
  decideImport,
  evaluateEnrichment,
  digitsOnly,
  detectCountry,
  COOLDOWN_DAYS,
} from '../lib/leadLogic';

const router = Router();
router.use(authenticate as any);

// GET /leads - get leads for current user (or all if admin/management)
// Query params: user_id, campaign_id, status, lifecycle_stage, limit, offset
// Special: user_id=unassigned → leads with no agent; adds assigned_agent_name to each row
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user!.role;
    const isAdmin = role === 'admin' || role === 'moderator';
    const isManagement = role === 'management';
    const { campaign_id, status, lifecycle_stage, limit = 100, offset = 0, user_id } = req.query;

    let sql = `SELECT l.*, c.name as campaign_name, p.full_name as assigned_agent_name
               FROM leads l
               LEFT JOIN campaigns c ON c.id = l.campaign_id
               LEFT JOIN profiles p ON p.id = l.user_id
               WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 1;

    if (!isAdmin && !isManagement) {
      sql += ` AND l.user_id = $${paramCount++}`;
      params.push(req.user!.id);
    } else if (isManagement) {
      sql += ` AND l.country = (SELECT country FROM profiles WHERE id = $${paramCount++})`;
      params.push(req.user!.id);
      if (user_id === 'unassigned') {
        sql += ` AND l.user_id IS NULL`;
      } else if (user_id) {
        sql += ` AND l.user_id = $${paramCount++}`;
        params.push(user_id);
      }
    } else if (user_id === 'unassigned') {
      sql += ` AND l.user_id IS NULL`;
    } else if (user_id && (isAdmin || isManagement)) {
      // Only apply additional user_id filter if admin/mgmt (CRM is already filtered above)
      sql += ` AND l.user_id = $${paramCount++}`;
      params.push(user_id);
    }

    const { segment, trait, priority, cooldown_expired } = req.query;

    if (campaign_id) {
      sql += ` AND l.campaign_id = $${paramCount++}`;
      params.push(campaign_id);
    }
    if (status && status !== 'all') {
      sql += ` AND l.status = $${paramCount++}`;
      params.push(status);
    }
    if (lifecycle_stage === 'pipeline') {
      sql += ` AND l.lifecycle_stage IN ('interested', 'promised')`;
    } else if (lifecycle_stage && lifecycle_stage !== 'all') {
      sql += ` AND l.lifecycle_stage = $${paramCount++}`;
      params.push(lifecycle_stage);
    }
    if (segment && segment !== 'all') {
      sql += ` AND l.segment = $${paramCount++}`;
      params.push(segment);
    }
    if (trait && trait !== 'all') {
      sql += ` AND l.trait = $${paramCount++}`;
      params.push(trait);
    }
    if (priority && priority !== 'all') {
      sql += ` AND COALESCE(l.priority, 'medium') = $${paramCount++}`;
      params.push(priority);
    }
    if (cooldown_expired === 'true') {
      sql += ` AND l.cooldown_until IS NOT NULL AND l.cooldown_until <= NOW()`;
    }

    sql += ` ORDER BY COALESCE(l.lead_score, l.score, 0) DESC, l.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(Number(limit), Number(offset));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch leads' }); }
});

// GET /leads/unassigned - get count and list of unassigned leads (admin/management)
router.get('/unassigned', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const isManagement = req.user!.role === 'management';
    const params: any[] = [];
    let countryClause = '';
    if (isManagement) {
      params.push(req.user!.id);
      countryClause = `AND country = (SELECT country FROM profiles WHERE id = $${params.length})`;
    }
    const countResult = await query(
      `SELECT COUNT(*) FROM leads WHERE user_id IS NULL ${countryClause}`,
      params
    );
    const listParams = [...params, Number(limit), Number(offset)];
    const result = await query(
      `SELECT l.*, c.name as campaign_name FROM leads l
       LEFT JOIN campaigns c ON c.id = l.campaign_id
       WHERE l.user_id IS NULL AND l.crm_owner_id IS NULL ${countryClause}
       ORDER BY COALESCE(l.lead_score, l.score, 0) DESC, l.created_at ASC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    res.json({ total: parseInt(countResult.rows[0].count), leads: result.rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch unassigned leads' }); }
});

// GET /leads/agents-available - get approved agents for distribution (admin/management)
router.get('/agents-available', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    const params: any[] = [];
    let sql = `SELECT p.id, p.full_name, p.email, p.status, p.manager_id, p.country, p.avatar_url,
                      r.role,
                      COUNT(l.id) as assigned_leads,
                      COALESCE(SUM(COALESCE(l.lead_score, l.score, 0)), 0) as total_score
               FROM profiles p
               JOIN user_roles r ON r.user_id = p.id AND r.role = 'agent'
               LEFT JOIN leads l ON l.user_id = p.id
               WHERE p.approved = TRUE`;
    if (isManagement) {
      params.push(req.user!.id);
      sql += ` AND p.country = (SELECT country FROM profiles WHERE id = $${params.length})`;
    }
    sql += ` GROUP BY p.id, p.full_name, p.email, p.status, p.manager_id, p.country, p.avatar_url, r.role ORDER BY p.full_name`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch available agents' }); }
});

// GET /leads/distribution-stats - current distribution overview (admin/management)
router.get('/distribution-stats', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    const cSub = `(SELECT country FROM profiles WHERE id = $1)`;
    const params = isManagement ? [req.user!.id] : [];

    const [unassigned, perAgent, totalLeads] = await Promise.all([
      isManagement
        ? query(`SELECT COUNT(*) FROM leads WHERE user_id IS NULL AND country = ${cSub}`, params)
        : query('SELECT COUNT(*) FROM leads WHERE user_id IS NULL'),
      isManagement
        ? query(
            `SELECT p.id, p.full_name, p.status,
                    COUNT(l.id) as lead_count,
                    COALESCE(SUM(COALESCE(l.lead_score, l.score, 0)), 0) as total_score,
                    COALESCE(AVG(COALESCE(l.lead_score, l.score, 0)), 0) as avg_score
             FROM profiles p
             JOIN user_roles r ON r.user_id = p.id AND r.role = 'agent'
             LEFT JOIN leads l ON l.user_id = p.id
             WHERE p.approved = TRUE AND p.country = ${cSub}
             GROUP BY p.id, p.full_name, p.status
             ORDER BY lead_count DESC`,
            params
          )
        : query(
            `SELECT p.id, p.full_name, p.status,
                    COUNT(l.id) as lead_count,
                    COALESCE(SUM(COALESCE(l.lead_score, l.score, 0)), 0) as total_score,
                    COALESCE(AVG(COALESCE(l.lead_score, l.score, 0)), 0) as avg_score
             FROM profiles p
             JOIN user_roles r ON r.user_id = p.id AND r.role = 'agent'
             LEFT JOIN leads l ON l.user_id = p.id
             WHERE p.approved = TRUE
             GROUP BY p.id, p.full_name, p.status
             ORDER BY lead_count DESC`
          ),
      isManagement
        ? query(`SELECT COUNT(*) FROM leads WHERE country = ${cSub}`, params)
        : query('SELECT COUNT(*) FROM leads'),
    ]);
    res.json({
      total_leads: parseInt(totalLeads.rows[0].count),
      unassigned_leads: parseInt(unassigned.rows[0].count),
      agents: perAgent.rows,
    });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch distribution stats' }); }
});

// GET /leads/category-counts - counts per segment category for Manage Leads overview
router.get('/category-counts', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    const params: any[] = [];
    let countryFilter = '';
    if (isManagement) {
      params.push(req.user!.id);
      countryFilter = `AND l.country = (SELECT country FROM profiles WHERE id = $1)`;
    }

    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE l.trait = 'High Staker') AS high_staker,
        COUNT(*) FILTER (WHERE l.trait = 'Medium Staker') AS medium_staker,
        COUNT(*) FILTER (WHERE l.trait = 'Frequent Bettor') AS frequent_bettor,
        COUNT(*) FILTER (WHERE l.segment = 'semi-active') AS active,
        COUNT(*) FILTER (WHERE l.segment = 'dormant' OR l.trait = 'Dormant') AS dormant,
        COUNT(*) FILTER (WHERE l.lifecycle_stage IN ('interested', 'promised')) AS pipeline,
        COUNT(*) FILTER (WHERE l.user_id IS NULL) AS unassigned,
        COUNT(*) AS total
      FROM leads l
      WHERE 1=1 ${countryFilter}
    `, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Leads] Category counts error:', err);
    res.status(500).json({ error: 'Failed to fetch category counts' });
  }
});

// POST /leads/import-csv - smart bulk import.
// Incoming numbers are merged into existing leads based on lifecycle state:
//   - never seen before       → insert
//   - in pipeline (new/called/interested/promised) → enrich data only, keep state
//   - already converted       → enrich + track repeat-deposit deltas
//   - marked dead >30 days    → recycle (reset to new with recycled flag)
//   - marked dead <30 days    → skip (too soon)
router.post('/import-csv', requireAdminOrCrm as any, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { numbers, leads: richLeads, distribute_to, source_filename } = req.body;
    
    // Fetch user profile to get country
    const profileRes = await client.query('SELECT country FROM profiles WHERE id = $1', [req.user!.id]);
    const userCountry = profileRes.rows[0]?.country;


    // Normalize both input shapes into a common rich array.
    type Incoming = {
      name: string; phone: string; phoneDigits: string;
      segment: string; priority: string; score: number; lead_score: number;
      last_deposit_ugx: number; lifetime_value: number; deposit_count: number;
      preferred_product: string | null; trait: string | null;
      betting_patterns: any; last_bet_date: string | null;
    };
    let incoming: Incoming[] = [];

    const buildFromRich = (l: any): Incoming | null => {
      const phone = String(l.phone || '').trim();
      const digits = digitsOnly(phone);
      if (digits.length < 7) return null;
      const bp = l.betting_patterns || {};
      const classification = classifyLead({
        deposit_usd: bp.deposit_usd ?? 0,
        deposit_local: bp.deposit_local ?? l.last_deposit_ugx ?? 0,
        total_bets: bp.total_bets ?? l.deposit_count ?? 0,
        last_login_date: bp.last_login ?? l.last_bet_date ?? null,
      });
      return {
        name: l.name || `User ${digits.slice(-4)}`,
        phone,
        phoneDigits: digits,
        segment: l.segment || classification.segment,
        priority: l.priority || classification.priority,
        score: l.score ?? classification.score,
        lead_score: l.lead_score ?? l.score ?? classification.score,
        last_deposit_ugx: Number(l.last_deposit_ugx || 0),
        lifetime_value: Number(l.lifetime_value || 0),
        deposit_count: Number(l.deposit_count || 0),
        preferred_product: l.preferred_product || null,
        trait: l.trait ?? classification.trait,
        betting_patterns: l.betting_patterns || null,
        last_bet_date: l.last_bet_date || null,
      };
    };

    if (richLeads && Array.isArray(richLeads) && richLeads.length > 0) {
      incoming = richLeads.map(buildFromRich).filter((x): x is Incoming => !!x);
    } else if (numbers && Array.isArray(numbers) && numbers.length > 0) {
      incoming = numbers
        .map((n: string) => {
          const phone = String(n || '').trim();
          const digits = digitsOnly(phone);
          if (digits.length < 7) return null;
          return {
            name: `User ${digits.slice(-4)}`,
            phone,
            phoneDigits: digits,
            segment: 'semi-active',
            priority: 'medium',
            score: 20,
            lead_score: 20,
            last_deposit_ugx: 0,
            lifetime_value: 0,
            deposit_count: 0,
            preferred_product: null,
            trait: null,
            betting_patterns: null,
            last_bet_date: null,
          } as Incoming;
        })
        .filter((x: Incoming | null): x is Incoming => !!x);
    } else {
      return res.status(400).json({ error: 'Provide an array of phone numbers or leads' });
    }

    // Dedupe within the file itself — keep the first occurrence of each number.
    const seen = new Set<string>();
    incoming = incoming.filter((l) => {
      if (seen.has(l.phoneDigits)) return false;
      seen.add(l.phoneDigits);
      return true;
    });

    if (incoming.length === 0) {
      return res.status(400).json({ error: 'No valid leads found' });
    }

    // Start transaction
    await client.query('BEGIN');

    // Look up existing leads by digits-only match (handles + vs no-+ variations).
    const existingRows = await client.query(
      `SELECT id, phone, lifecycle_stage, call_count, last_contact_at, last_activity,
              score, lead_score, import_count, betting_patterns, user_id
       FROM leads
       WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ANY($1)`,
      [incoming.map((l) => l.phoneDigits)]
    );
    const existingByDigits = new Map<string, any>();
    for (const r of existingRows.rows) {
      existingByDigits.set(digitsOnly(r.phone), r);
    }

    const newRecords: Incoming[] = [];
    const enrichUpdates: Array<{ row: any; fresh: Incoming; decision: ReturnType<typeof decideImport> }> = [];
    const recycles: Array<{ row: any; fresh: Incoming }> = [];
    const skipped: Array<{ phone: string; reason: string }> = [];

    for (const lead of incoming) {
      const existing = existingByDigits.get(lead.phoneDigits) || null;
      const decision = decideImport(existing);
      switch (decision.action) {
        case 'insert':
          newRecords.push(lead);
          break;
        case 'update_full':
        case 'update_enrich_only':
        case 'update_with_delta':
          enrichUpdates.push({ row: existing, fresh: lead, decision });
          break;
        case 'recycle':
          recycles.push({ row: existing, fresh: lead });
          break;
        case 'skip':
          skipped.push({ phone: lead.phone, reason: decision.reason });
          break;
      }
    }

    // INSERT net-new leads.
    const BATCH_SIZE = 500;
    const newlyInsertedIds: string[] = [];
    for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
      const batch = newRecords.slice(i, i + BATCH_SIZE);
      const insertValues: string[] = [];
      const insertParams: any[] = [];
      let p = 1;
      for (const lead of batch) {
        let country = detectCountry(lead.phone, userCountry || 'UG');
        const isCrm = req.user!.role === 'crm';
        const isCrmOrManager = isCrm || req.user!.role === 'management';
        
        // CRM agents and managers are strictly bound to their country
        if (isCrmOrManager && userCountry) {
          country = userCountry;
        }

        insertValues.push(
          `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`
        );
        insertParams.push(
          lead.name, lead.phone, lead.segment, lead.priority, lead.score,
          lead.last_deposit_ugx, lead.lifetime_value, lead.deposit_count,
          lead.preferred_product, lead.trait,
          lead.betting_patterns ? JSON.stringify(lead.betting_patterns) : null,
          lead.last_bet_date, lead.lead_score, country, 'new',
          isCrm ? req.user!.id : null, // user_id
          isCrm ? req.user!.id : null  // crm_owner_id
        );
      }
      const ins = await client.query(
        `INSERT INTO leads (
           name, phone, segment, priority, score,
           last_deposit_ugx, lifetime_value, deposit_count,
           preferred_product, trait, betting_patterns,
           last_bet_date, lead_score, country, lifecycle_stage,
           user_id, crm_owner_id
         ) VALUES ${insertValues.join(', ')} RETURNING id`,
        insertParams
      );
      for (const row of ins.rows) newlyInsertedIds.push(row.id);
    }

    // Emit imported events for newly-inserted leads.
    for (let i = 0; i < newlyInsertedIds.length; i += BATCH_SIZE) {
      const batch = newlyInsertedIds.slice(i, i + BATCH_SIZE);
      const eventParams: any[] = [];
      const eventValues: string[] = [];
      let p = 1;
      for (const id of batch) {
        eventValues.push(`($${p++}, $${p++}, $${p++}, $${p++})`);
        eventParams.push(id, req.user!.id, 'imported', JSON.stringify({ source_filename }));
      }
      await client.query(
        `INSERT INTO lead_events (lead_id, user_id, event_type, event_data) VALUES ${eventValues.join(', ')}`,
        eventParams
      );
    }

    // UPDATE existing leads via enrichUpdates.
    let upgraded = 0;
    let downgraded = 0;
    // For large volumes, individual updates are still slow even in a transaction.
    // However, a transaction helps significantly. We'll also batch the lead_events.
    const enrichmentEventData: Array<{ lead_id: string; data: any }> = [];
    
    for (const { row, fresh, decision } of enrichUpdates) {
      const prevScore = Number(row.lead_score ?? row.score ?? 0);
      const newScore = fresh.lead_score;
      if (newScore > prevScore + 5) upgraded++;
      else if (newScore < prevScore - 5) downgraded++;

      const fields: string[] = [];
      const values: any[] = [];
      let p = 1;

      fields.push(`betting_patterns = $${p++}`);
      values.push(fresh.betting_patterns ? JSON.stringify(fresh.betting_patterns) : null);
      fields.push(`last_deposit_ugx = $${p++}`);
      values.push(fresh.last_deposit_ugx);
      fields.push(`lifetime_value = $${p++}`);
      values.push(fresh.lifetime_value);
      fields.push(`deposit_count = $${p++}`);
      values.push(fresh.deposit_count);
      fields.push(`last_bet_date = $${p++}`);
      values.push(fresh.last_bet_date);
      fields.push(`preferred_product = COALESCE($${p++}, preferred_product)`);
      values.push(fresh.preferred_product);
      fields.push(`last_imported_at = NOW()`);
      fields.push(`import_count = COALESCE(import_count, 1) + 1`);

      if (decision.action === 'update_full') {
        fields.push(`segment = $${p++}`); values.push(fresh.segment);
        fields.push(`priority = $${p++}`); values.push(fresh.priority);
        fields.push(`score = $${p++}`); values.push(fresh.score);
        fields.push(`lead_score = $${p++}`); values.push(fresh.lead_score);
        fields.push(`trait = $${p++}`); values.push(fresh.trait);
      }

      fields.push(`updated_at = NOW()`);
      values.push(row.id);

      // Extra safety for CRM: ensure country matches if user is CRM
      if (req.user!.role === 'crm' && userCountry) {
        fields.push(`country = $${p++}`);
        values.push(userCountry);
      }

      await client.query(`UPDATE leads SET ${fields.join(', ')} WHERE id = $${p}`, values);

      enrichmentEventData.push({
        lead_id: row.id,
        data: {
          reason: decision.reason,
          source_filename,
          prev_score: prevScore,
          new_score: newScore,
          score_change: newScore - prevScore,
        }
      });
    }

    // Batch insert enrichment events.
    for (let i = 0; i < enrichmentEventData.length; i += BATCH_SIZE) {
      const batch = enrichmentEventData.slice(i, i + BATCH_SIZE);
      const eventParams: any[] = [];
      const eventValues: string[] = [];
      let p = 1;
      for (const item of batch) {
        eventValues.push(`($${p++}, $${p++}, $${p++}, $${p++})`);
        eventParams.push(item.lead_id, req.user!.id, 'enriched', JSON.stringify(item.data));
      }
      await client.query(
        `INSERT INTO lead_events (lead_id, user_id, event_type, event_data) VALUES ${eventValues.join(', ')}`,
        eventParams
      );
    }

    // RECYCLE dead leads.
    for (const { row, fresh } of recycles) {
      await client.query(
        `UPDATE leads SET
           lifecycle_stage = 'new', status = NULL, last_activity = NULL, cooldown_until = NULL,
           recycled_from_dead_at = NOW(), last_imported_at = NOW(),
           import_count = COALESCE(import_count, 1) + 1,
           betting_patterns = $1, last_deposit_ugx = $2, lifetime_value = $3, deposit_count = $4,
           last_bet_date = $5, preferred_product = COALESCE($6, preferred_product),
           segment = $7, priority = $8, score = $9, lead_score = $10, trait = $11,
           updated_at = NOW()
         WHERE id = $12`,
        [
          fresh.betting_patterns ? JSON.stringify(fresh.betting_patterns) : null,
          fresh.last_deposit_ugx, fresh.lifetime_value, fresh.deposit_count,
          fresh.last_bet_date, fresh.preferred_product,
          fresh.segment, fresh.priority, fresh.score, fresh.lead_score, fresh.trait,
          row.id,
        ]
      );
      await client.query(
        `INSERT INTO lead_events (lead_id, user_id, event_type, event_data) VALUES ($1, $2, $3, $4)`,
        [row.id, req.user!.id, 'recycled', JSON.stringify({ source_filename })]
      );
    }

    // Distribute newly-inserted and recycled leads.
    let distributed = 0;
    if (distribute_to && Array.isArray(distribute_to) && distribute_to.length > 0) {
      const recycleIds = recycles.map((r) => r.row.id);
      const idsToDistribute = [...newlyInsertedIds, ...recycleIds];
      
      // Batch distribution updates.
      for (let i = 0; i < idsToDistribute.length; i += BATCH_SIZE) {
        const batch = idsToDistribute.slice(i, i + BATCH_SIZE);
        for (let j = 0; j < batch.length; j++) {
          const agentId = distribute_to[(i + j) % distribute_to.length];
          await client.query(
            `UPDATE leads SET user_id = $1, assigned_by = $2, assigned_at = NOW() WHERE id = $3`,
            [agentId, req.user!.id, batch[j]]
          );
        }
      }
      distributed = idsToDistribute.length;
    }

    // Log the batch.
    await client.query(
      `INSERT INTO import_batches (
         user_id, batch_type, source_filename, total_rows,
         new_count, updated_count, recycled_count, skipped_count,
         upgraded_count, downgraded_count, summary
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        req.user!.id, 'new_leads', source_filename || null, incoming.length,
        newlyInsertedIds.length, enrichUpdates.length, recycles.length, skipped.length,
        upgraded, downgraded,
        JSON.stringify({ distributed, skipped: skipped.slice(0, 50) }),
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      total: incoming.length,
      inserted: newlyInsertedIds.length,
      enriched: enrichUpdates.length,
      recycled: recycles.length,
      skipped: skipped.length,
      upgraded,
      downgraded,
      distributed,
      skipped_detail: skipped.slice(0, 50),
      imported: newlyInsertedIds.length,
      duplicates: enrichUpdates.length + skipped.length,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[Leads] CSV import error:', err);
    res.status(500).json({ error: 'Failed to import leads' });
  } finally {
    client.release();
  }
});

// POST /leads/import-performance - smart enrichment refresh.
// Cross-references fresh platform data against each lead's call history:
//   - deposit grew AND last_login is after our last call → attribute to agent
//   - attributable deposit + lead was interested/promised → promote to 'converted'
//   - classification score changed significantly → flag upgraded/downgraded
// Returns a rich breakdown for the redistribute-after-refresh UI.
router.post('/import-performance', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { data, source_filename } = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Provide an array of performance data' });
    }

    // Normalize incoming rows; accept both shapes (raw platform export + minimal).
    const rows = data
      .map((item: any) => {
        const digits = digitsOnly(item.phone);
        if (digits.length < 7) return null;
        return {
          phoneDigits: digits,
          deposit_usd: Number(item.deposit_usd ?? 0),
          deposit_local: Number(item.deposit_local ?? item.deposit_amount ?? 0),
          total_bets: Number(item.total_bets ?? item.bet_count ?? 0),
          last_login_date: item.last_login_date || item.last_login || item.last_activity || null,
          deposit_date: item.deposit_date || null,
          category: item.category || null,
        };
      })
      .filter((x: any) => x);

    if (rows.length === 0) return res.status(400).json({ error: 'No valid rows' });

    const existing = await query(
      `SELECT id, phone, lifecycle_stage, last_contact_at, score, lead_score,
              betting_patterns, attributed_deposit_ugx, user_id, call_count
       FROM leads
       WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ANY($1)`,
      [rows.map((r: any) => r.phoneDigits)]
    );
    const byDigits = new Map<string, any>();
    for (const r of existing.rows) byDigits.set(digitsOnly(r.phone), r);

    const result = {
      matched: 0,
      unmatched: 0,
      upgraded: 0,
      downgraded: 0,
      unchanged: 0,
      conversions_attributed: 0,
      attributed_deposit_ugx: 0,
      converted_ids: [] as string[],
      upgraded_ids: [] as string[],
      unmatched_phones: [] as string[],
    };

    for (const row of rows) {
      const lead = byDigits.get(row.phoneDigits);
      if (!lead) {
        result.unmatched++;
        if (result.unmatched_phones.length < 100) result.unmatched_phones.push(row.phoneDigits);
        continue;
      }
      result.matched++;

      const prevBP = lead.betting_patterns || {};
      const newClassification = classifyLead({
        deposit_usd: row.deposit_usd,
        deposit_local: row.deposit_local,
        total_bets: row.total_bets,
        last_login_date: row.last_login_date,
      });

      const outcome = evaluateEnrichment({
        previous: {
          deposit_usd: Number(prevBP.deposit_usd || 0),
          total_bets: Number(prevBP.total_bets || lead.deposit_count || 0),
          lifecycle_stage: lead.lifecycle_stage,
          last_contact_at: lead.last_contact_at,
          score: Number(lead.lead_score ?? lead.score ?? 0),
        },
        fresh: {
          deposit_usd: row.deposit_usd,
          total_bets: row.total_bets,
          last_login_date: row.last_login_date,
        },
        newClassification,
      });

      // Merge fresh values into betting_patterns JSONB.
      const mergedBP = {
        ...prevBP,
        deposit_usd: row.deposit_usd,
        deposit_local: row.deposit_local,
        total_bets: row.total_bets,
        last_login: row.last_login_date || prevBP.last_login,
      };

      const attributableUgx = outcome.attributable_deposit_usd * 3700; // rough USD→UGX
      const shouldConvert = outcome.conversion_triggered;

      const updates: string[] = [
        `betting_patterns = $1`,
        `lifetime_value = $2`,
        `deposit_count = $3`,
        `last_bet_date = $4`,
        `last_enriched_at = NOW()`,
        `performance_updated_at = NOW()`,
        `updated_at = NOW()`,
      ];
      const values: any[] = [
        JSON.stringify(mergedBP),
        row.deposit_local || row.deposit_usd * 3700,
        row.total_bets,
        row.last_login_date || null,
      ];
      let p = 5;

      if (attributableUgx > 0) {
        updates.push(`attributed_deposit_ugx = COALESCE(attributed_deposit_ugx, 0) + $${p++}`);
        values.push(attributableUgx);
        updates.push(`post_call_deposit_ugx = COALESCE(post_call_deposit_ugx, 0) + $${p++}`);
        values.push(attributableUgx);
      }
      if (outcome.bets_delta > 0) {
        updates.push(`post_call_bet_count = COALESCE(post_call_bet_count, 0) + $${p++}`);
        values.push(outcome.bets_delta);
      }

      // Re-score: only update if lead is not actively being worked.
      // For pipeline stages we keep the existing score so we don't disturb the agent's view.
      const stage = lead.lifecycle_stage as string | null;
      const isActive = stage === 'called' || stage === 'interested' || stage === 'promised';
      if (!isActive) {
        updates.push(`segment = $${p++}`); values.push(newClassification.segment);
        updates.push(`priority = $${p++}`); values.push(newClassification.priority);
        updates.push(`score = $${p++}`); values.push(newClassification.score);
        updates.push(`lead_score = $${p++}`); values.push(newClassification.score);
        updates.push(`trait = $${p++}`); values.push(newClassification.trait);
      }

      if (shouldConvert) {
        updates.push(`lifecycle_stage = 'converted'`);
        result.conversions_attributed++;
        result.attributed_deposit_ugx += attributableUgx;
        result.converted_ids.push(lead.id);
      }

      values.push(lead.id);
      await query(
        `UPDATE leads SET ${updates.join(', ')} WHERE id = $${p}`,
        values
      );

      // Emit event.
      await query(
        `INSERT INTO lead_events (lead_id, user_id, event_type, event_data) VALUES ($1, $2, $3, $4)`,
        [
          lead.id, req.user!.id,
          shouldConvert ? 'converted' : 'enriched',
          JSON.stringify({
            source_filename,
            deposit_delta_usd: outcome.deposit_delta_usd,
            bets_delta: outcome.bets_delta,
            last_login_after_call: outcome.last_login_after_call,
            attributable_deposit_usd: outcome.attributable_deposit_usd,
            attributable_deposit_ugx: attributableUgx,
            classification_changed: outcome.classification_changed,
            prev_stage: stage,
            new_stage: shouldConvert ? 'converted' : stage,
          }),
        ]
      );

      if (outcome.classification_changed === 'upgraded') {
        result.upgraded++;
        result.upgraded_ids.push(lead.id);
      } else if (outcome.classification_changed === 'downgraded') {
        result.downgraded++;
      } else {
        result.unchanged++;
      }
    }

    // Log the batch for history.
    await query(
      `INSERT INTO import_batches (
         user_id, batch_type, source_filename, total_rows,
         updated_count, upgraded_count, downgraded_count, converted_count,
         attributed_deposit_ugx, summary
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        req.user!.id, 'performance_refresh', source_filename || null, rows.length,
        result.matched, result.upgraded, result.downgraded, result.conversions_attributed,
        result.attributed_deposit_ugx,
        JSON.stringify({ unmatched: result.unmatched, unmatched_phones: result.unmatched_phones.slice(0, 50) }),
      ]
    );

    res.json(result);
  } catch (err) {
    console.error('[Leads] Performance import error:', err);
    res.status(500).json({ error: 'Failed to import performance data' });
  }
});

// GET /leads/export-phones - CSV of current lead phone numbers for tech-team enrichment
router.get('/export-phones', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { stage } = req.query as { stage?: string };
    const isManagement = req.user!.role === 'management';
    const params: any[] = [];
    let sql = `SELECT phone, lifecycle_stage, trait, last_contact_at, call_count
               FROM leads WHERE 1=1`;
    if (isManagement) {
      params.push(req.user!.id);
      sql += ` AND country = (SELECT country FROM profiles WHERE id = $${params.length})`;
    }
    if (stage) { params.push(stage); sql += ` AND lifecycle_stage = $${params.length}`; }
    sql += ` ORDER BY last_contact_at DESC NULLS LAST`;
    const result = await query(sql, params);
    const header = 'phone,stage,trait,last_contact,call_count\n';
    const body = result.rows.map((r: any) =>
      [r.phone, r.lifecycle_stage || '', r.trait || '', r.last_contact_at || '', r.call_count || 0]
        .map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="phones-for-enrichment-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(header + body);
  } catch (err) {
    console.error('[Leads] Export phones error:', err);
    res.status(500).json({ error: 'Failed to export phones' });
  }
});

// GET /leads/import-batches - recent import history (country-scoped for management)
router.get('/import-batches', requireAdminOrCrm as any, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 20 } = req.query;
    const isManagement = req.user!.role === 'management';
    let sql: string;
    let params: any[];
    if (isManagement) {
      sql = `SELECT b.*, p.full_name AS user_name
             FROM import_batches b LEFT JOIN profiles p ON p.id = b.user_id
             WHERE b.user_id IN (
               SELECT id FROM profiles WHERE country = (SELECT country FROM profiles WHERE id = $1)
             )
             ORDER BY b.created_at DESC LIMIT $2`;
      params = [req.user!.id, Number(limit)];
    } else if (req.user!.role === 'crm') {
      sql = `SELECT b.*, p.full_name AS user_name
             FROM import_batches b LEFT JOIN profiles p ON p.id = b.user_id
             WHERE b.user_id = $1
             ORDER BY b.created_at DESC LIMIT $2`;
      params = [req.user!.id, Number(limit)];
    } else {
      sql = `SELECT b.*, p.full_name AS user_name
             FROM import_batches b LEFT JOIN profiles p ON p.id = b.user_id
             ORDER BY b.created_at DESC LIMIT $1`;
      params = [Number(limit)];
    }
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Leads] Import batches fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch import batches' });
  }
});

// POST /leads
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, segment = 'general', priority = 'medium', campaign, campaign_id, ...rest } = req.body;
    const result = await query(
      `INSERT INTO leads (user_id, name, phone, segment, priority, campaign, campaign_id, intent, tags, last_bet_date, last_deposit_ugx, score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [req.user!.id, name, phone, segment, priority, campaign, campaign_id, rest.intent, rest.tags, rest.last_bet_date, rest.last_deposit_ugx, rest.score]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to create lead' }); }
});

// GET /leads/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user!.role;
    const result = await query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    const lead = result.rows[0];
    // Agents can only see leads assigned to them
    if (role === 'agent' && lead.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // Management can only see leads in their country
    if (role === 'management') {
      const cpResult = await query('SELECT country FROM profiles WHERE id = $1', [req.user!.id]);
      const country = cpResult.rows[0]?.country;
      if (lead.country && country && lead.country !== country) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    res.json(lead);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch lead' }); }
});

// PATCH /leads/:id
// Augments the update: when a disposition (status/last_activity/lifecycle_stage)
// arrives we bump call_count, set cooldown_until, and emit a disposition event.
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const fields = { ...req.body };
    const disposition: string | null =
      fields.status || fields.last_activity || fields.lifecycle_stage || null;

    const setParts: string[] = [];
    const values: any[] = [];
    let p = 2;

    for (const [k, v] of Object.entries(fields)) {
      setParts.push(`${k} = $${p++}`);
      values.push(v);
    }

    if (disposition && COOLDOWN_DAYS[disposition]) {
      const cooldownUntil = new Date(Date.now() + COOLDOWN_DAYS[disposition] * 86_400_000);
      setParts.push(`cooldown_until = $${p++}`);
      values.push(cooldownUntil);
    }

    // Only bump call_count when a disposition field is being set (not for arbitrary PATCHes).
    if (disposition) {
      setParts.push(`call_count = COALESCE(call_count, 0) + 1`);
    }

    setParts.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE leads SET ${setParts.join(', ')} WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );

    if (disposition && result.rows[0]) {
      await query(
        `INSERT INTO lead_events (lead_id, user_id, event_type, event_data) VALUES ($1, $2, $3, $4)`,
        [req.params.id, req.user!.id, 'disposition', JSON.stringify({ disposition, fields })]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Leads] PATCH error:', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// GET /leads/:id/events - full history of a lead
router.get('/:id/events', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT e.*, p.full_name AS user_name FROM lead_events e
       LEFT JOIN profiles p ON p.id = e.user_id
       WHERE e.lead_id = $1 ORDER BY e.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch lead events' }); }
});

// DELETE /leads/clear-all - permanently delete all leads from the database (admin/management only)
// Management role is country-scoped; admin deletes everything.
// NOTE: must be registered BEFORE /:id to prevent Express from matching 'clear-all' as an id.
router.delete('/clear-all', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'admin';
    let deleted: number;

    if (isAdmin) {
      // Admin: delete lead_events first (FK), then all leads
      await query('DELETE FROM lead_events WHERE lead_id IN (SELECT id FROM leads)');
      await query('DELETE FROM import_batches');
      const result = await query('DELETE FROM leads');
      deleted = result.rowCount ?? 0;
    } else {
      // Management: scope to their country only
      const cpResult = await query('SELECT country FROM profiles WHERE id = $1', [req.user!.id]);
      const country = cpResult.rows[0]?.country;
      if (!country) return res.status(400).json({ error: 'Country not found for your account' });

      await query(
        'DELETE FROM lead_events WHERE lead_id IN (SELECT id FROM leads WHERE country = $1)',
        [country]
      );
      const result = await query('DELETE FROM leads WHERE country = $1', [country]);
      deleted = result.rowCount ?? 0;
    }

    res.json({ message: `Deleted ${deleted} lead${deleted === 1 ? '' : 's'} from the database`, deleted });
  } catch (err) {
    console.error('[Leads] Clear-all error:', err);
    res.status(500).json({ error: 'Failed to clear leads' });
  }
});

// DELETE /leads/clear-by-status - delete all leads with a specific status (admin/management only)
// Body: { status: string } — use "unassigned" for leads with no status.
// Management role is country-scoped.
// NOTE: must be registered BEFORE /:id.
router.delete('/clear-by-status', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body as { status?: string };
    if (!status) return res.status(400).json({ error: 'Provide a status to clear' });

    const isAdmin = req.user!.role === 'admin';
    let country: string | null = null;
    if (!isAdmin) {
      const cpResult = await query('SELECT country FROM profiles WHERE id = $1', [req.user!.id]);
      country = cpResult.rows[0]?.country || null;
      if (!country) return res.status(400).json({ error: 'Country not found for your account' });
    }

    // Build WHERE clause for status matching
    let statusWhere: string;
    const params: any[] = [];
    let p = 1;

    if (status === 'unassigned') {
      // "unassigned" = no status, empty string, 'pending', or explicitly 'unassigned'
      statusWhere = `(status IS NULL OR status = '' OR status = 'unassigned' OR status = 'pending')`;
    } else if (status === 'no_answer') {
      // Accept both internal values
      statusWhere = `status IN ('no_answer', 'called_no_answer')`;
    } else {
      params.push(status);
      statusWhere = `status = $${p++}`;
    }

    if (country) {
      params.push(country);
      statusWhere += ` AND country = $${p++}`;
    }

    // Cascade: delete events first, then the leads
    await query(
      `DELETE FROM lead_events WHERE lead_id IN (SELECT id FROM leads WHERE ${statusWhere})`,
      params
    );
    const result = await query(`DELETE FROM leads WHERE ${statusWhere}`, params);
    const deleted = result.rowCount ?? 0;

    res.json({
      message: `Deleted ${deleted} lead${deleted === 1 ? '' : 's'} with status "${status}"`,
      deleted,
      status,
    });
  } catch (err) {
    console.error('[Leads] Clear-by-status error:', err);
    res.status(500).json({ error: 'Failed to clear leads by status' });
  }
});

// DELETE /leads/clear-by-trait - delete all leads in a Manage Leads category (admin/management only)
// categoryId matches the CATEGORIES ids in distribute.tsx:
//   high_staker, medium_staker, frequent_bettor, dormant → trait field
//   pipeline → lifecycle_stage IN ('interested','promised')
//   unassigned → user_id IS NULL
// "all" deletes everything (same as clear-all).
// NOTE: must be registered BEFORE /:id.
router.delete('/clear-by-trait', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId } = req.body as { categoryId?: string };
    if (!categoryId) return res.status(400).json({ error: 'Provide a categoryId' });

    const isAdmin = req.user!.role === 'admin';
    let country: string | null = null;

    // Management ALWAYS gets their country — no bypass possible
    if (!isAdmin) {
      const cpResult = await query(
        'SELECT country FROM profiles WHERE id = $1',
        [req.user!.id]
      );
      country = cpResult.rows[0]?.country || null;
      if (!country) return res.status(400).json({ error: 'Country not found for your account' });
    }

    // Build the WHERE clause using parameterized values only
    const params: any[] = [];
    let p = 1;
    let baseWhere: string;

    if (categoryId === 'all') {
      baseWhere = '1=1'; // country clause appended below if management
    } else if (categoryId === 'unassigned') {
      baseWhere = 'user_id IS NULL';
    } else if (categoryId === 'pipeline') {
      baseWhere = `lifecycle_stage IN ('interested','promised')`;
    } else {
      // Trait-based — whitelist so arbitrary values can't be injected
      const traitMap: Record<string, string> = {
        high_staker: 'High Staker',
        medium_staker: 'Medium Staker',
        frequent_bettor: 'Frequent Bettor',
        dormant: 'Dormant',
      };
      const trait = traitMap[categoryId];
      if (!trait) return res.status(400).json({ error: `Unknown categoryId: ${categoryId}` });
      params.push(trait);
      baseWhere = `trait = $${p++}`;
    }

    // Always append country filter for management roles — parameterized
    let where = baseWhere;
    if (country) {
      params.push(country);
      where = `(${baseWhere}) AND country = $${p++}`;
    }

    // Cascade: delete events first (FK), then leads
    await query(
      `DELETE FROM lead_events WHERE lead_id IN (SELECT id FROM leads WHERE ${where})`,
      params
    );
    const result = await query(`DELETE FROM leads WHERE ${where}`, params);
    const deleted = result.rowCount ?? 0;

    res.json({
      message: `Deleted ${deleted} lead${deleted === 1 ? '' : 's'} from category "${categoryId}"${country ? ` (country: ${country})` : ''}`,
      deleted,
      categoryId,
    });
  } catch (err) {
    console.error('[Leads] Clear-by-trait error:', err);
    res.status(500).json({ error: 'Failed to clear leads by category' });
  }
});

// DELETE /leads/:id — only admins and management can delete individual leads
router.delete('/:id', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const isManagement = req.user!.role === 'management';
    if (isManagement) {
      // Scope delete to management's country — they cannot delete leads from other countries
      const cpResult = await query('SELECT country FROM profiles WHERE id = $1', [req.user!.id]);
      const country = cpResult.rows[0]?.country;
      if (!country) return res.status(400).json({ error: 'Country not found for your account' });
      const result = await query(
        'DELETE FROM leads WHERE id = $1 AND country = $2 RETURNING id',
        [req.params.id, country]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Lead not found in your country' });
    } else {
      await query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    }
    res.json({ message: 'Lead deleted' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete lead' }); }
});

// POST /leads/distribute - smart fair distribution (admin only)
// Uses the same score-based fairness algorithm as the desktop app
router.post('/distribute', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { agent_ids, lead_ids, limit: leadLimit } = req.body;

    // Determine the caller's country for scoping (management is country-scoped; admin sees all)
    const isAdmin = req.user!.role === 'admin';
    let callerCountry: string | null = null;
    if (!isAdmin) {
      const cpResult = await query('SELECT country FROM profiles WHERE id = $1', [req.user!.id]);
      callerCountry = cpResult.rows[0]?.country || null;
    }

    // Get target agents - either specified or all approved agents (scoped by country)
    let agents: { id: string; full_name: string }[];
    if (agent_ids && agent_ids.length > 0) {
      const agentResult = await query(
        `SELECT p.id, p.full_name FROM profiles p
         JOIN user_roles r ON r.user_id = p.id AND r.role = 'agent'
         WHERE p.approved = TRUE AND p.id = ANY($1)`,
        [agent_ids]
      );
      agents = agentResult.rows;
    } else {
      const params: any[] = [];
      let sql = `SELECT p.id, p.full_name FROM profiles p
         JOIN user_roles r ON r.user_id = p.id AND r.role = 'agent'
         WHERE p.approved = TRUE`;
      if (callerCountry) {
        params.push(callerCountry);
        sql += ` AND p.country = $${params.length}`;
      }
      sql += ` ORDER BY p.full_name`;
      const agentResult = await query(sql, params);
      agents = agentResult.rows;
    }

    if (agents.length === 0) {
      return res.status(400).json({ error: 'No approved agents available for distribution' });
    }

    // Get leads to distribute - scoped by country
    let leads: { id: string; lead_score: number }[];
    if (lead_ids && lead_ids.length > 0) {
      const leadResult = await query(
        `SELECT id, COALESCE(lead_score, score, 0) as lead_score FROM leads
         WHERE id = ANY($1) ORDER BY COALESCE(lead_score, score, 0) DESC`,
        [lead_ids]
      );
      leads = leadResult.rows;
    } else {
      const queryLimit = leadLimit ? `LIMIT ${parseInt(leadLimit)}` : '';
      const params: any[] = [];
      let sql = `SELECT id, COALESCE(lead_score, score, 0) as lead_score FROM leads WHERE user_id IS NULL`;
      if (callerCountry) {
        params.push(callerCountry);
        sql += ` AND country = $${params.length}`;
      }
      sql += ` ORDER BY COALESCE(lead_score, score, 0) DESC ${queryLimit}`;
      const leadResult = await query(sql, params);
      leads = leadResult.rows;
    }

    if (leads.length === 0) {
      return res.status(400).json({ error: 'No leads available for distribution' });
    }

    // Fair distribution algorithm (same as desktop AdminDashboard)
    // Tracks total score and count per agent, assigns each lead to the agent
    // with the lowest total score (fairness by value), breaking ties by count
    const agentStats: Map<string, { count: number; totalScore: number; name: string }> = new Map();
    for (const agent of agents) {
      agentStats.set(agent.id, { count: 0, totalScore: 0, name: agent.full_name });
    }

    const assignments: { leadId: string; agentId: string }[] = [];

    for (const lead of leads) {
      // Find agent with lowest total score, then lowest count
      let bestAgentId = agents[0].id;
      let bestStats = agentStats.get(bestAgentId)!;

      for (const agent of agents) {
        const stats = agentStats.get(agent.id)!;
        if (
          stats.totalScore < bestStats.totalScore ||
          (stats.totalScore === bestStats.totalScore && stats.count < bestStats.count)
        ) {
          bestAgentId = agent.id;
          bestStats = stats;
        }
      }

      assignments.push({ leadId: lead.id, agentId: bestAgentId });
      bestStats.count++;
      bestStats.totalScore += lead.lead_score;
    }

    // Batch update in groups of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
      const batch = assignments.slice(i, i + BATCH_SIZE);
      const promises = batch.map(({ leadId, agentId }) =>
        query(
          'UPDATE leads SET user_id = $1, assigned_by = $2, assigned_at = NOW(), updated_at = NOW() WHERE id = $3',
          [agentId, req.user!.id, leadId]
        )
      );
      await Promise.all(promises);
    }

    // Build summary per agent
    const summary = Array.from(agentStats.entries()).map(([id, stats]) => ({
      agent_id: id,
      agent_name: stats.name,
      leads_assigned: stats.count,
      total_score: stats.totalScore,
    }));

    res.json({
      message: `Distributed ${assignments.length} leads to ${agents.length} agents`,
      total_distributed: assignments.length,
      agents: summary,
    });
  } catch (err) {
    console.error('[Leads] Distribution error:', err);
    res.status(500).json({ error: 'Failed to distribute leads' });
  }
});

// POST /leads/bulk-assign - assign or unassign multiple leads at once (admin/management)
// Body: { lead_ids: string[], agent_id: string | null }
// agent_id = null → unassign; agent_id = userId → assign to that agent
router.post('/bulk-assign', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const { lead_ids, agent_id } = req.body;
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ error: 'Provide a non-empty array of lead_ids' });
    }

    const isManagement = req.user!.role === 'management';

    if (agent_id) {
      // Verify agent exists and belongs to manager's country
      if (isManagement) {
        const check = await query(
          `SELECT p.id FROM profiles p
           JOIN user_roles r ON r.user_id = p.id AND r.role = 'agent'
           WHERE p.id = $1 AND p.approved = TRUE
           AND p.country = (SELECT country FROM profiles WHERE id = $2)`,
          [agent_id, req.user!.id]
        );
        if (check.rows.length === 0) {
          return res.status(403).json({ error: 'Agent not found in your country' });
        }
      }

      let sql = `UPDATE leads SET user_id = $1, assigned_by = $2, assigned_at = NOW(), updated_at = NOW()
                 WHERE id = ANY($3)`;
      const params: any[] = [agent_id, req.user!.id, lead_ids];
      if (isManagement) {
        params.push(req.user!.id);
        sql += ` AND country = (SELECT country FROM profiles WHERE id = $${params.length})`;
      }
      const result = await query(sql, params);
      res.json({ message: `Assigned ${result.rowCount} lead${result.rowCount === 1 ? '' : 's'}`, updated: result.rowCount });
    } else {
      let sql = `UPDATE leads SET user_id = NULL, assigned_by = NULL, assigned_at = NULL, updated_at = NOW()
                 WHERE id = ANY($1)`;
      const params: any[] = [lead_ids];
      if (isManagement) {
        params.push(req.user!.id);
        sql += ` AND country = (SELECT country FROM profiles WHERE id = $${params.length})`;
      }
      const result = await query(sql, params);
      res.json({ message: `Unassigned ${result.rowCount} lead${result.rowCount === 1 ? '' : 's'}`, updated: result.rowCount });
    }
  } catch (err) {
    console.error('[Leads] Bulk assign error:', err);
    res.status(500).json({ error: 'Failed to bulk assign leads' });
  }
});

// POST /leads/unassign-all - remove all lead assignments (admin only)
router.post('/unassign-all', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'UPDATE leads SET user_id = NULL, assigned_by = NULL, assigned_at = NULL, updated_at = NOW() WHERE user_id IS NOT NULL'
    );
    res.json({ message: `Unassigned ${result.rowCount} leads` });
  } catch (err) { res.status(500).json({ error: 'Failed to unassign leads' }); }
});



export default router;
