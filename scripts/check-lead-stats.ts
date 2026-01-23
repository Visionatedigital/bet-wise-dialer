import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeadStats() {
    try {
        console.log('=== Lead Stats ===\n');

        // Get all agents
        const { data: agentRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'agent');

        const agentIds = agentRoles?.map(r => r.user_id) || [];

        const { data: agents } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', agentIds);

        // Get lead counts
        const { data: leads } = await supabase
            .from('leads')
            .select('user_id');

        const stats: Record<string, number> = {};
        let unassigned = 0;

        leads?.forEach(l => {
            if (l.user_id) {
                stats[l.user_id] = (stats[l.user_id] || 0) + 1;
            } else {
                unassigned++;
            }
        });

        console.log(`Total Leads: ${leads?.length}`);
        console.log(`Unassigned: ${unassigned}`);
        console.log('\nAgent Distribution:');

        agents?.forEach(a => {
            console.log(`${a.full_name}: ${stats[a.id] || 0}`);
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

checkLeadStats();
