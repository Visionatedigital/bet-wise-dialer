import { query } from '../db';

async function initCrmSchema() {
  console.log('Starting CRM Schema Initialization...');

  try {
    // 1. Update leads table with additional CRM fields
    console.log('Updating leads table...');
    await query(`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS vip_level VARCHAR(50),
      ADD COLUMN IF NOT EXISTS risk_status VARCHAR(50),
      ADD COLUMN IF NOT EXISTS favourite_game VARCHAR(100),
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS last_deposit_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS total_deposits DECIMAL(15, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS current_bonus DECIMAL(15, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS preferred_contact_time VARCHAR(100);
    `);

    // 2. Create contact_timeline table
    console.log('Creating contact_timeline table...');
    await query(`
      CREATE TABLE IF NOT EXISTS contact_timeline (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        agent_id UUID REFERENCES users(id),
        event_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        summary TEXT,
        outcome TEXT,
        next_action TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_timeline_contact ON contact_timeline(contact_id);
    `);

    // 3. Create call_logs table (distinct from call_activities for CRM context)
    console.log('Creating call_logs table...');
    await query(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        agent_id UUID NOT NULL REFERENCES users(id),
        phone_number VARCHAR(20) NOT NULL,
        call_outcome VARCHAR(50) NOT NULL,
        client_mood VARCHAR(50),
        reason_for_contact VARCHAR(100),
        result VARCHAR(100),
        next_action VARCHAR(100),
        notes TEXT,
        ai_summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_call_logs_contact ON call_logs(contact_id);
    `);

    // 4. Update/Create whatsapp_conversations table
    console.log('Ensuring whatsapp_conversations table...');
    await query(`
      CREATE TABLE IF NOT EXISTS whatsapp_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL REFERENCES users(id),
        contact_phone TEXT NOT NULL,
        contact_name TEXT,
        phone_number_id TEXT,
        display_phone_number TEXT,
        last_message_text TEXT,
        last_message_at TIMESTAMPTZ,
        unread_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES leads(id) ON DELETE CASCADE;
      ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS whatsapp_business_number VARCHAR(20);
      ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
    `);

    // 5. Update/Create whatsapp_messages table
    console.log('Ensuring whatsapp_messages table...');
    await query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
        whatsapp_message_id TEXT,
        content TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        status TEXT DEFAULT 'sent',
        media_type TEXT,
        media_url TEXT,
        timestamp TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES leads(id) ON DELETE CASCADE;
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES users(id);
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS direction VARCHAR(10); -- 'inbound', 'outbound'
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS body TEXT;
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS metadata JSONB;
    `);

    // 6. Create ai_whispers table
    console.log('Creating ai_whispers table...');
    await query(`
      CREATE TABLE IF NOT EXISTS ai_whispers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
        message_id UUID REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
        agent_id UUID NOT NULL REFERENCES users(id),
        should_intervene BOOLEAN DEFAULT FALSE,
        intervention_type VARCHAR(50),
        priority VARCHAR(20),
        whisper_text TEXT,
        suggested_reply TEXT,
        next_action TEXT,
        sentiment VARCHAR(50),
        intent VARCHAR(50),
        risk_flag BOOLEAN DEFAULT FALSE,
        dismissed BOOLEAN DEFAULT FALSE,
        used_reply BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 7. Create agent_activity table
    console.log('Creating agent_activity table...');
    await query(`
      CREATE TABLE IF NOT EXISTS agent_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL REFERENCES users(id),
        contact_id UUID REFERENCES leads(id) ON DELETE SET NULL,
        activity_type VARCHAR(50) NOT NULL,
        result VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    console.log('CRM Schema Initialization Completed Successfully!');
  } catch (error) {
    console.error('Error during CRM Schema Initialization:', error);
    process.exit(1);
  }
}

initCrmSchema().then(() => process.exit(0));
