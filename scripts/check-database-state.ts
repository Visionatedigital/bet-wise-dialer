import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseState() {
    try {
        console.log('=== Database State Check ===\n');

        // Check profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email');

        console.log('📊 PROFILES:');
        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
        } else {
            console.log(`Total profiles: ${profiles?.length || 0}`);
            profiles?.forEach(p => {
                console.log(`  - ${p.full_name || 'No name'} (${p.email || 'No email'})`);
            });
        }

        // Check user_roles
        const { data: roles, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id, role');

        console.log('\n👥 USER ROLES:');
        if (rolesError) {
            console.error('Error fetching roles:', rolesError);
        } else {
            console.log(`Total roles: ${roles?.length || 0}`);
            const agentRoles = roles?.filter(r => r.role === 'agent') || [];
            console.log(`Agent roles: ${agentRoles.length}`);
            agentRoles.forEach(r => {
                const profile = profiles?.find(p => p.id === r.user_id);
                console.log(`  - ${profile?.full_name || 'Unknown'} (${r.user_id})`);
            });
        }

        // Check leads
        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('id, user_id, assigned_at, name, phone, segment');

        console.log('\n📋 LEADS:');
        if (leadsError) {
            console.error('Error fetching leads:', leadsError);
        } else {
            console.log(`Total leads: ${leads?.length || 0}`);
            const unassigned = leads?.filter(l => !l.user_id) || [];
            const assigned = leads?.filter(l => l.user_id) || [];
            console.log(`Unassigned leads: ${unassigned.length}`);
            console.log(`Assigned leads: ${assigned.length}`);

            if (unassigned.length > 0) {
                console.log('\nFirst 5 unassigned leads:');
                unassigned.slice(0, 5).forEach(l => {
                    console.log(`  - ${l.name} (${l.phone}) - ${l.segment}`);
                });
            }

            if (assigned.length > 0) {
                console.log('\nFirst 5 assigned leads:');
                assigned.slice(0, 5).forEach(l => {
                    const profile = profiles?.find(p => p.id === l.user_id);
                    console.log(`  - ${l.name} → ${profile?.full_name || 'Unknown agent'} (assigned: ${l.assigned_at})`);
                });
            }
        }

        // Check auth.users
        console.log('\n🔐 AUTH USERS:');
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

        if (authError) {
            console.error('Error fetching auth users:', authError);
        } else {
            console.log(`Total auth users: ${authUsers?.users?.length || 0}`);
            authUsers?.users?.forEach(u => {
                console.log(`  - ${u.email} (ID: ${u.id})`);
            });
        }

        console.log('\n=== Summary ===');
        console.log(`Profiles: ${profiles?.length || 0}`);
        console.log(`Auth Users: ${authUsers?.users?.length || 0}`);
        console.log(`Agent Roles: ${roles?.filter(r => r.role === 'agent').length || 0}`);
        console.log(`Total Leads: ${leads?.length || 0}`);
        console.log(`Unassigned Leads: ${leads?.filter(l => !l.user_id).length || 0}`);
        console.log(`Assigned Leads: ${leads?.filter(l => l.user_id).length || 0}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

checkDatabaseState();
