import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeadsStatus() {
    try {
        console.log('=== Checking Leads Status ===\n');

        // Check total leads
        const { data: allLeads, error: allError } = await supabase
            .from('leads')
            .select('id, user_id, assigned_at, name')
            .order('created_at', { ascending: false })
            .limit(10);

        if (allError) {
            console.error('Error fetching leads:', allError);
            return;
        }

        console.log(`Total leads (showing first 10):`);
        allLeads?.forEach((lead, i) => {
            console.log(`  ${i + 1}. ${lead.name}`);
            console.log(`     user_id: ${lead.user_id || 'NULL'}`);
            console.log(`     assigned_at: ${lead.assigned_at || 'NULL'}`);
        });

        // Check unassigned leads
        const { data: unassigned, count: unassignedCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: false })
            .is('user_id', null);

        console.log(`\n📊 Unassigned leads (user_id = NULL): ${unassignedCount}`);

        // Check assigned leads
        const { data: assigned, count: assignedCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: false })
            .not('user_id', 'is', null);

        console.log(`📊 Assigned leads (user_id NOT NULL): ${assignedCount}`);

        // Check agents
        const { data: agents } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'agent');

        console.log(`\n👥 Total agents: ${agents?.length || 0}`);

        if (agents && agents.length > 0) {
            console.log('\nLeads per agent:');
            for (const agent of agents) {
                const { data: agentLeads, count } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: false })
                    .eq('user_id', agent.user_id);

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', agent.user_id)
                    .single();

                console.log(`  ${profile?.full_name || agent.user_id}: ${count} leads`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkLeadsStatus();
