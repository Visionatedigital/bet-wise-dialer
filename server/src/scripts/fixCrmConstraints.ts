import { query } from '../db';

async function fixSchemaConstraints() {
  console.log('Fixing CRM Schema Constraints...');

  try {
    // Make agent_id nullable in whatsapp_conversations
    console.log('Making whatsapp_conversations.agent_id nullable...');
    await query(`ALTER TABLE whatsapp_conversations ALTER COLUMN agent_id DROP NOT NULL;`);

    // Make agent_id nullable in ai_whispers
    console.log('Making ai_whispers.agent_id nullable...');
    await query(`ALTER TABLE ai_whispers ALTER COLUMN agent_id DROP NOT NULL;`);

    console.log('Constraints fixed successfully!');
  } catch (error) {
    console.error('Error fixing constraints:', error);
    process.exit(1);
  }
}

fixSchemaConstraints().then(() => process.exit(0));
