import axios from "axios";

const API_BASE = "http://159.89.51.97:3001/api";

async function main() {
  try {
    console.log("Connecting to custom server Express API...");
    
    // Login
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: "admin@bangbet.test",
      password: "AdminPassword2026!",
    });

    const token = loginRes.data.token;
    console.log("Logged in successfully! Token received.");

    const authHeaders = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    // Let's query call activities
    // We want to query calls for the past week: e.g. since June 9, 2026
    const now = new Date("2026-06-16T10:31:56+03:00");
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

    console.log(`Querying call activities from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const callsUrl = `${API_BASE}/call-activities?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&limit=10000`;
    console.log("URL:", callsUrl);
    
    const callsRes = await axios.get(callsUrl, authHeaders);
    const calls = callsRes.data;
    
    console.log(`Fetched ${calls.length} calls from custom server for the week.`);

    if (calls.length > 0) {
      console.log("\nSample calls:");
      calls.slice(0, 5).forEach((c: any, i: number) => {
        console.log(`${i+1}. ID: ${c.id}, phone: ${c.phone_number}, created_at: ${c.created_at}, agent: ${c.agent_name}`);
      });

      // Let's do some checks
      // Check 1: Deduplication within 10-minute window
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
          group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          let lastKeptCall: any = null;
          group.forEach((call) => {
            const callTime = new Date(call.created_at).getTime();
            if (!lastKeptCall) {
              lastKeptCall = call;
              deduplicated.push(call);
            } else {
              const timeDiff = callTime - new Date(lastKeptCall.created_at).getTime();
              if (timeDiff > DEDUP_WINDOW_MS) {
                lastKeptCall = call;
                deduplicated.push(call);
              }
            }
          });
        });
        return deduplicated;
      };

      const dedupedCalls = deduplicateAllCalls(calls);
      console.log(`Deduplicated calls: ${dedupedCalls.length}`);
    }

  } catch (err: any) {
    console.error("Error connecting to custom server:", err.response?.data || err.message);
  }
}

main();
