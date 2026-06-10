import { query } from './src/db';

async function run() {
  try {
    const res = await query("SELECT id FROM users WHERE email = 'crm@bangbet.com'");
    if (res.rows.length === 0) {
      console.log('CRM user not found');
      return;
    }
    const crmUserId = res.rows[0].id;
    
    // Check if lead exists
    const leadCheck = await query("SELECT id FROM leads WHERE phone = '256756990141'");
    if (leadCheck.rows.length > 0) {
      await query("UPDATE leads SET user_id = $1, crm_owner_id = $1, segment = 'vip' WHERE phone = '256756990141'", [crmUserId]);
      console.log('Lead updated and assigned to CRM user.');
    } else {
      await query(`
        INSERT INTO leads (name, phone, segment, priority, status, user_id, crm_owner_id, country)
        VALUES ('Test CRM Lead', '256756990141', 'vip', 'high', 'new', $1, $1, 'UG')
      `, [crmUserId]);
      console.log('Lead inserted and assigned to CRM user.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
