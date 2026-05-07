import { Server } from 'socket.io';
import { query } from '../db';

/**
 * Intelligent Notification Worker
 * Runs periodic checks to identify clients needing attention and generates 
 * database-backed notifications and real-time socket alerts.
 */
export async function startNotificationWorker(io: Server) {
  console.log('[Notification Worker] Starting intelligent monitoring service...');

  // Run every 5 minutes
  setInterval(async () => {
    try {
      console.log('[Notification Worker] Checking for priority relationship alerts...');
      
      // 1. Monitor VIP follow-ups (No contact in 48h)
      const vipAlerts = await query(`
        SELECT id, name, user_id, phone, last_contact_at 
        FROM leads 
        WHERE segment = 'vip' 
        AND (last_contact_at < NOW() - INTERVAL '48 hours' OR last_contact_at IS NULL)
        AND user_id IS NOT NULL
      `);

      for (const lead of vipAlerts.rows) {
        // Check if we already sent a notification for this recently (last 24h)
        const existing = await query(`
          SELECT id FROM notifications 
          WHERE user_id = $1 
          AND type = 'follow_up' 
          AND metadata->>'lead_id' = $2
          AND created_at > NOW() - INTERVAL '24 hours'
        `, [lead.user_id, lead.id.toString()]);

        if (existing.rows.length === 0) {
          const title = 'VIP Priority Follow-up';
          const message = `${lead.name} requires attention. No contact for 48h.`;
          
          // Insert into DB
          const saved = await query(`
            INSERT INTO notifications (user_id, type, title, message, metadata, read, created_at)
            VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
            RETURNING *
          `, [lead.user_id, 'follow_up', title, message, JSON.stringify({ lead_id: lead.id })]);

          // Emit real-time signal
          io.to(`user_${lead.user_id}`).emit('new_notification', saved.rows[0]);
          console.log(`[Notification Worker] Created VIP alert for User ${lead.user_id} regarding Lead ${lead.id}`);
        }
      }

      // 2. Monitor High-Value Dormancy (Score > 80, no contact in 7 days)
      const dormantAlerts = await query(`
        SELECT id, name, user_id, score
        FROM leads 
        WHERE score > 80 
        AND (last_contact_at < NOW() - INTERVAL '7 days' OR last_contact_at IS NULL)
        AND user_id IS NOT NULL
      `);

      for (const lead of dormantAlerts.rows) {
        const existing = await query(`
          SELECT id FROM notifications 
          WHERE user_id = $1 
          AND type = 'follow_up' 
          AND metadata->>'lead_id' = $2
          AND created_at > NOW() - INTERVAL '48 hours'
        `, [lead.user_id, lead.id.toString()]);

        if (existing.rows.length === 0) {
          const title = 'High Value Dormancy';
          const message = `High-score client ${lead.name} has been dormant for 7 days.`;
          
          const saved = await query(`
            INSERT INTO notifications (user_id, type, title, message, metadata, read, created_at)
            VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
            RETURNING *
          `, [lead.user_id, 'follow_up', title, message, JSON.stringify({ lead_id: lead.id })]);

          io.to(`user_${lead.user_id}`).emit('new_notification', saved.rows[0]);
        }
      }

    } catch (err) {
      console.error('[Notification Worker] Error in monitoring cycle:', err);
    }
  }, 1000 * 60 * 5); // 5 minutes
}
