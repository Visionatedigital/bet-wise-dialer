/**
 * Backfill script: reads the betting platform XLSX and updates
 * existing leads in the database with betting stats (deposit, bets, GGR, trait, etc.)
 * Matches by phone number. Preserves agent assignments.
 *
 * Usage: npx ts-node scripts/backfill-betting-data.ts
 */
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { config } from '../src/config';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
});

const COLUMN_MAP: Record<string, string> = {
  'username': 'phone',
  '最后登录时间': 'last_login',
  '分类': 'category',
  '总票数': 'total_bets',
  '体育票数': 'sports_bets',
  '游戏票数': 'game_bets',
  '充值金额(美金)': 'deposit_usd',
  '充值金额(本币)': 'deposit_local',
  '账面coupon成本': 'coupon_cost',
  'coupon': 'coupon',
  '是否充值': 'has_deposited',
  '充值金额': 'deposit_amount',
  '投注总金额': 'total_bet_amount',
  '总ggr': 'total_ggr',
  '体育投注金额': 'sports_bet_amount',
  '游戏投注金额': 'game_bet_amount',
  '体育ggr': 'sports_ggr',
  '游戏ggr': 'game_ggr',
};

const PRODUCT_MAP: Record<string, string> = {
  '体育': 'Sports',
  '游戏': 'Gaming',
  '彩票': 'Lottery',
};

function parseNum(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  return parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
}

function excelDateToISO(serial: any): string | null {
  if (!serial) return null;
  if (typeof serial === 'string') {
    const d = new Date(serial);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }
  if (typeof serial === 'number') {
    const utcDays = Math.floor(serial - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  return null;
}

function classify(data: Record<string, any>) {
  const depositUSD = parseNum(data.deposit_usd);
  const depositLocal = parseNum(data.deposit_local);
  const totalBets = parseNum(data.total_bets);

  if (depositUSD >= 1000 || depositLocal >= 3500000) {
    return {
      segment: 'vip', priority: 'high',
      score: Math.min(95, 70 + Math.floor(depositUSD / 500)),
      trait: 'High Staker',
    };
  }
  if (depositUSD >= 200 || depositLocal >= 700000) {
    return {
      segment: 'semi-active', priority: 'medium',
      score: Math.min(70, 40 + Math.floor(depositUSD / 100)),
      trait: 'Medium Staker',
    };
  }
  if (totalBets >= 500) {
    return { segment: 'semi-active', priority: 'medium', score: 45, trait: 'Frequent Bettor' };
  }

  const lastLogin = excelDateToISO(data.last_login);
  if (lastLogin) {
    const daysSince = Math.floor((Date.now() - new Date(lastLogin).getTime()) / 86400000);
    if (daysSince > 60) {
      return { segment: 'dormant', priority: 'low', score: 15, trait: 'Dormant' };
    }
  }

  return {
    segment: depositUSD > 50 ? 'semi-active' : 'dormant',
    priority: depositUSD > 50 ? 'medium' : 'low',
    score: depositUSD > 50 ? 35 : 20,
    trait: depositUSD > 0 ? 'Low Staker' : null,
  };
}

async function main() {
  const xlsxPath = path.resolve(__dirname, '../../downloads/SAMPLE XLS NUMBERS.xlsx');
  console.log(`Reading ${xlsxPath}...`);

  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);

  console.log(`Found ${rows.length} rows in XLSX`);

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const raw of rows) {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(raw as any)) {
      normalized[COLUMN_MAP[key] || key] = value;
    }

    const phone = String(normalized.phone || '').trim();
    if (!phone || phone.length < 7) continue;

    // Try multiple phone formats to match what's in the DB
    const phoneCandidates = [
      phone,
      `+${phone}`,
      phone.startsWith('+') ? phone.slice(1) : phone,
    ];

    const classification = classify(normalized);
    const depositUSD = parseNum(normalized.deposit_usd);
    const depositLocal = parseNum(normalized.deposit_local);
    const totalBets = parseNum(normalized.total_bets);
    const sportsBets = parseNum(normalized.sports_bets);
    const gameBets = parseNum(normalized.game_bets);
    const totalGGR = parseNum(normalized.total_ggr);
    const sportsGGR = parseNum(normalized.sports_ggr);
    const gameGGR = parseNum(normalized.game_ggr);
    const totalBetAmount = parseNum(normalized.total_bet_amount);
    const sportsBetAmount = parseNum(normalized.sports_bet_amount);
    const gameBetAmount = parseNum(normalized.game_bet_amount);
    const lastLogin = excelDateToISO(normalized.last_login);
    const category = String(normalized.category || '');
    const preferredProduct = PRODUCT_MAP[category] || (sportsBets > gameBets ? 'Sports' : gameBets > 0 ? 'Gaming' : null);

    const bettingPatterns = {
      deposit_usd: depositUSD,
      deposit_local: depositLocal,
      total_bets: totalBets,
      sports_bets: sportsBets,
      game_bets: gameBets,
      total_ggr: totalGGR,
      sports_ggr: sportsGGR,
      game_ggr: gameGGR,
      total_bet_amount: totalBetAmount,
      sports_bet_amount: sportsBetAmount,
      game_bet_amount: gameBetAmount,
      last_login: lastLogin,
      platform_category: category,
    };

    try {
      const result = await pool.query(
        `UPDATE leads SET
          segment = $1,
          priority = $2,
          score = $3,
          lead_score = $3,
          trait = $4,
          preferred_product = $5,
          last_deposit_ugx = $6,
          lifetime_value = $7,
          deposit_count = $8,
          last_bet_date = $9,
          betting_patterns = $10,
          updated_at = NOW()
        WHERE phone = ANY($11)`,
        [
          classification.segment,
          classification.priority,
          classification.score,
          classification.trait,
          preferredProduct,
          depositLocal || Math.round(depositUSD * 3700),
          depositLocal || Math.round(depositUSD * 3700),
          totalBets,
          lastLogin,
          JSON.stringify(bettingPatterns),
          phoneCandidates,
        ]
      );

      if (result.rowCount && result.rowCount > 0) {
        updated++;
      } else {
        notFound++;
      }
    } catch (err: any) {
      errors++;
      console.error(`Error updating ${phone}:`, err.message);
    }
  }

  console.log(`\nDone!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Not found in DB: ${notFound}`);
  console.log(`  Errors: ${errors}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
