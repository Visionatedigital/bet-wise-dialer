import fs from 'fs';
import path from 'path';
import { query } from '../db';

async function runMigration() {
  const migrationPath = path.join(__dirname, '../../migrations/20260508_crm_activity_v2.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running migration: 20260508_crm_activity_v2.sql');
  
  try {
    // Split by semi-colon and execute individually to handle potential errors better
    // but be careful with DO blocks and functions. 
    // For now, we'll run the whole thing.
    await query(sql);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration().then(() => process.exit(0));
