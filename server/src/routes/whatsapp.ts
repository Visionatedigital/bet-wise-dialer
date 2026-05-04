import { Router, Request, Response } from 'express';
import { query } from '../db';
import { config } from '../config';

const router = Router();

/**
 * GET /webhook
 * Verification endpoint for Meta WhatsApp Business API
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      console.log('[WhatsApp Webhook] Verified!');
      return res.status(200).send(challenge);
    } else {
      console.warn('[WhatsApp Webhook] Verification failed. Token mismatch.');
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

/**
 * POST /webhook
 * Receives incoming WhatsApp messages and status updates
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Log the incoming message for debugging
    // console.log('[WhatsApp Webhook] Received:', JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const message = body.entry[0].changes[0].value.messages[0];
        const contact = body.entry[0].changes[0].value.contacts[0];
        const metadata = body.entry[0].changes[0].value.metadata;
        const phone_number_id = metadata.phone_number_id;
        const from = message.from; // Sender's phone number
        const msg_body = message.text ? message.text.body : '(media/other)';
        const msg_id = message.id;

        console.log(`[WhatsApp Webhook] New message from ${from}: ${msg_body}`);

        // 1. Find or create conversation
        // We link it to a lead if the phone number matches
        const leadResult = await query(
          'SELECT id, name, user_id FROM leads WHERE phone LIKE $1 OR phone = $2 LIMIT 1',
          [`%${from.slice(-9)}%`, from]
        );
        const contact_id = leadResult.rows[0]?.id || null;
        const agent_id = leadResult.rows[0]?.user_id || null;
        const contact_name = leadResult.rows[0]?.name || contact.profile.name;

        let convResult = await query(
          `SELECT id FROM whatsapp_conversations WHERE contact_phone = $1 OR contact_id = $2`,
          [from, contact_id]
        );

        let conversation_id;
        if (convResult.rows.length === 0) {
          const insertConv = await query(
            `INSERT INTO whatsapp_conversations (
              contact_phone, contact_name, contact_id, agent_id, phone_number_id, status
            ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [from, contact_name, contact_id, agent_id, phone_number_id, 'active']
          );
          conversation_id = insertConv.rows[0].id;
        } else {
          conversation_id = convResult.rows[0].id;
        }

        // 2. Save incoming message
        await query(
          `INSERT INTO whatsapp_messages (
            conversation_id, contact_id, direction, body, whatsapp_message_id, sender_type, content, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [conversation_id, contact_id, 'inbound', msg_body, msg_id, 'contact', msg_body]
        );

        // 3. Update conversation timestamp and unread count
        await query(
          `UPDATE whatsapp_conversations SET 
            last_message_text = $1, 
            last_message_at = NOW(), 
            unread_count = unread_count + 1,
            updated_at = NOW() 
          WHERE id = $2`,
          [msg_body, conversation_id]
        );

        // 4. Add to contact timeline
        if (contact_id) {
          await query(
            `INSERT INTO contact_timeline (
              contact_id, event_type, title, summary
            ) VALUES ($1, $2, $3, $4)`,
            [contact_id, 'whatsapp', 'Incoming WhatsApp', msg_body]
          );
        }

        // TODO: Trigger AI Whisper analysis (Phase 4)
      }
      return res.status(200).send('EVENT_RECEIVED');
    } else {
      return res.sendStatus(404);
    }
  } catch (err) {
    console.error('[WhatsApp Webhook] Error:', err);
    return res.sendStatus(500);
  }
});

/**
 * POST /send
 * Sends an outgoing WhatsApp message via Meta Graph API
 */
router.post('/send', async (req: any, res: Response) => {
  try {
    const { contact_id, phone, body } = req.body;
    const agent_id = req.user?.id;

    if (!phone || !body) {
      return res.status(400).json({ error: 'Phone and body are required' });
    }

    if (!config.whatsapp.token || !config.whatsapp.phoneNumberId) {
      return res.status(500).json({ error: 'WhatsApp API not configured on server' });
    }

    const cleanPhone = phone.replace(/\+/g, '');

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${config.whatsapp.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.whatsapp.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { body: body },
        }),
      }
    );

    const data: any = await response.json();

    if (!response.ok) {
      console.error('[WhatsApp Send] Meta API Error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Meta API Error' });
    }

    const whatsapp_message_id = data.messages[0].id;

    // 1. Find or create conversation
    let convResult = await query(
      `SELECT id FROM whatsapp_conversations WHERE contact_phone = $1 OR contact_id = $2`,
      [cleanPhone, contact_id]
    );

    let conversation_id;
    if (convResult.rows.length === 0) {
      const leadResult = await query('SELECT name FROM leads WHERE id = $1', [contact_id]);
      const contact_name = leadResult.rows[0]?.name || cleanPhone;
      const insertConv = await query(
        `INSERT INTO whatsapp_conversations (
          contact_phone, contact_name, contact_id, phone_number_id, status
        ) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [cleanPhone, contact_name, contact_id, config.whatsapp.phoneNumberId, 'active']
      );
      conversation_id = insertConv.rows[0].id;
    } else {
      conversation_id = convResult.rows[0].id;
    }

    // 2. Save outgoing message
    await query(
      `INSERT INTO whatsapp_messages (
        conversation_id, contact_id, agent_id, direction, body, whatsapp_message_id, sender_type, content, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [conversation_id, contact_id, agent_id, 'outbound', body, whatsapp_message_id, 'agent', body]
    );

    // 3. Update conversation last message
    await query(
      `UPDATE whatsapp_conversations SET 
        last_message_text = $1, 
        last_message_at = NOW(), 
        updated_at = NOW() 
      WHERE id = $2`,
      [body, conversation_id]
    );

    // 4. Add to contact timeline
    if (contact_id) {
      await query(
        `INSERT INTO contact_timeline (
          contact_id, agent_id, event_type, title, summary
        ) VALUES ($1, $2, $3, $4, $5)`,
        [contact_id, agent_id, 'whatsapp', 'Outgoing WhatsApp', body]
      );
    }

    res.json({ success: true, message_id: whatsapp_message_id });
  } catch (err) {
    console.error('[WhatsApp Send] Error:', err);
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
});

export default router;
