import { Pool } from "pg";

const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "bangbet",
  user: "bangbet",
  password: "BangBet_DB_2026!",
});

async function main() {
  try {
    console.log("Checking local PostgreSQL database bangbet...");
    
    // Check if call_activities table exists
    const tableCheck = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'call_activities')"
    );
    if (!tableCheck.rows[0].exists) {
      console.log("Table 'call_activities' does not exist in local DB!");
      return;
    }

    const countRes = await pool.query("SELECT COUNT(*) FROM call_activities");
    console.log(`Total calls in call_activities: ${countRes.rows[0].count}`);

    const recentCalls = await pool.query(
      "SELECT id, start_time, created_at, user_id, status, phone_number FROM call_activities ORDER BY start_time DESC LIMIT 10"
    );

    console.log("\n10 Most Recent Calls:");
    recentCalls.rows.forEach((c, idx) => {
      console.log(`${idx + 1}. ID: ${c.id}, start_time: ${c.start_time}, created_at: ${c.created_at}, status: ${c.status}, phone: ${c.phone_number}`);
    });

    // Let's run a query for the date ranges
    const now = new Date("2026-06-16T10:31:56+03:00");
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    // Range 1: 7 days ago (June 9 10:31:56)
    const startDateNoHours = new Date(now);
    startDateNoHours.setDate(startDateNoHours.getDate() - 7);

    // Range 2: 7 days ago, start of day (June 9 00:00:00)
    const startDateWithHours = new Date(now);
    startDateWithHours.setDate(startDateWithHours.getDate() - 7);
    startDateWithHours.setHours(0, 0, 0, 0);

    // Range 3: Monday start (June 15 00:00:00)
    const monday = new Date(now);
    const day = monday.getDay();
    const diff = (day + 6) % 7;
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0, 0, 0, 0);

    // Range 4: Sunday start (June 14 00:00:00)
    const sunday = new Date(now);
    sunday.setDate(sunday.getDate() - sunday.getDay());
    sunday.setHours(0, 0, 0, 0);

    const runQuery = async (label: string, start: Date) => {
      const q = "SELECT COUNT(*) FROM call_activities WHERE start_time >= $1 AND start_time <= $2";
      const res = await pool.query(q, [start.toISOString(), endDate.toISOString()]);
      console.log(`  ${label} (since ${start.toLocaleString()}): ${res.rows[0].count} calls`);
      return Number(res.rows[0].count);
    };

    console.log("\nCall counts in different ranges:");
    await runQuery("No Hours (past 7 days exactly)", startDateNoHours);
    await runQuery("With Hours = 0 (past 7 days start of day)", startDateWithHours);
    await runQuery("Monday Start (current calendar week)", monday);
    await runQuery("Sunday Start (Sunday to now)", sunday);

    // Let's check all call statuses and deduplication logic
    const allCallsRes = await pool.query(
      "SELECT * FROM call_activities WHERE start_time >= $1 AND start_time <= $2",
      [startDateWithHours.toISOString(), endDate.toISOString()]
    );
    const allCalls = allCallsRes.rows;

    const deduplicateAllCalls = (calls: any[]): any[] => {
      if (!calls || calls.length === 0) return [];
      const callGroups = new Map<string, any[]>();
      calls.forEach((call) => {
        const key = `${call.user_id}_${call.phone_number || 'unknown'}`;
        if (!callGroups.has(key)) callGroups.set(key, []);
        callGroups.get(key)!.push(call);
      });
      const deduplicated: any[] = [];
      const DEDUP_WINDOW_MS = 10 * 60 * 1000;
      callGroups.forEach((group) => {
        if (group.length === 1) {
          deduplicated.push(group[0]);
          return;
        }
        group.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        let lastKeptCall: any = null;
        group.forEach((call) => {
          const callTime = new Date(call.start_time).getTime();
          if (!lastKeptCall) {
            lastKeptCall = call;
            deduplicated.push(call);
          } else {
            const timeDiff = callTime - new Date(lastKeptCall.start_time).getTime();
            if (timeDiff > DEDUP_WINDOW_MS) {
              lastKeptCall = call;
              deduplicated.push(call);
            }
          }
        });
      });
      return deduplicated;
    };

    console.log(`\nFor Past 7 Days (Hours = 0):`);
    console.log(`  Total database records: ${allCalls.length}`);
    console.log(`  Deduplicated records: ${deduplicateAllCalls(allCalls).length}`);

  } catch (err) {
    console.error("Database connection error:", err);
  } finally {
    await pool.end();
  }
}

main();
