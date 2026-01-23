import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addAssignedAtColumn() {
    try {
        console.log('Adding assigned_at column to leads table...');

        // Execute SQL to add the column
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: `
        ALTER TABLE public.leads 
        ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;
        
        CREATE INDEX IF NOT EXISTS idx_leads_assigned_at 
        ON public.leads(assigned_at);
      `
        });

        if (error) {
            console.error('Error:', error);
            console.log('\nTrying alternative approach...');

            // Alternative: Just try to query the column to see if it exists
            const { data: testData, error: testError } = await supabase
                .from('leads')
                .select('assigned_at')
                .limit(1);

            if (testError) {
                console.error('Column does not exist:', testError.message);
                console.log('\n❌ Please add the column manually in Supabase Dashboard:');
                console.log('   SQL Editor > Run this query:');
                console.log('   ALTER TABLE public.leads ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE;');
            } else {
                console.log('✅ Column already exists!');
            }
        } else {
            console.log('✅ Column added successfully!');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

addAssignedAtColumn();
