import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAgents() {
    try {
        console.log('Checking agents eligibility...');

        // 1. Get Agent Roles
        const { data: agentRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'agent');

        if (rolesError) {
            console.error('Error fetching roles:', rolesError);
            return;
        }

        const agentIds = agentRoles?.map(r => r.user_id) || [];
        console.log(`Found ${agentIds.length} users with 'agent' role.`);

        // 2. Get Profiles that are approved
        const { data: agents, error: agentsError } = await supabase
            .from('profiles')
            .select('id, full_name, approved, status')
            .in('id', agentIds)
            .eq('approved', true);

        if (agentsError) {
            console.error('Error fetching profiles:', agentsError);
            return;
        }

        console.log(`Found ${agents?.length} approved agents ready for distribution:`);
        agents?.forEach(a => {
            console.log(`- ${a.full_name} (Status: ${a.status})`);
        });

        if (agents?.length !== 9) {
            console.warn('WARNING: Expected 9 agents, but found only ' + agents?.length);

            // Debug: Check why others are missing
            const { data: allProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, approved')
                .in('id', agentIds);

            const approvedIds = agents?.map(a => a.id) || [];
            const missing = allProfiles?.filter(p => !approvedIds.includes(p.id)) || [];

            if (missing.length > 0) {
                console.log('\nMissing Agents (Role=Agent but Approved=False?):');
                missing.forEach(m => console.log(`- ${m.full_name} (Approved: ${m.approved})`));
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkAgents();
