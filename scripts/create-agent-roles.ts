import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAgentRoles() {
    try {
        console.log('=== Creating Agent Roles ===\n');

        // Agent names from your dashboard
        const agentNames = [
            'Hamza rehemaah',
            'LAKOT CAROLINE OKELLO',
            'mushakamba kabahizi shadrak',
            'nabulya betty',
            'Nakitende Tifan',
            'Nalugwa Bridget',
            'nambogo nashibah',
            'regina arionget',
            'Sheebah mushakamba'
        ];

        console.log(`Looking for ${agentNames.length} users to assign agent role...\n`);

        // Get all profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email');

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            return;
        }

        console.log(`Found ${profiles?.length || 0} total profiles\n`);

        // Find matching profiles
        const matchedProfiles = profiles?.filter(p =>
            agentNames.some(name =>
                p.full_name?.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(p.full_name?.toLowerCase() || '')
            )
        ) || [];

        console.log(`Matched ${matchedProfiles.length} profiles:\n`);
        matchedProfiles.forEach(p => {
            console.log(`  - ${p.full_name} (${p.email})`);
        });

        if (matchedProfiles.length === 0) {
            console.log('\n❌ No matching profiles found');
            console.log('\nShowing all profiles:');
            profiles?.forEach(p => {
                console.log(`  - ${p.full_name} (${p.email})`);
            });
            return;
        }

        // Assign agent role to each
        console.log('\n📝 Assigning agent roles...\n');
        let created = 0;

        for (const profile of matchedProfiles) {
            // Check if role already exists
            const { data: existing } = await supabase
                .from('user_roles')
                .select('*')
                .eq('user_id', profile.id)
                .eq('role', 'agent')
                .single();

            if (existing) {
                console.log(`  ✓ ${profile.full_name} - already has agent role`);
                continue;
            }

            // Insert agent role
            const { error: insertError } = await supabase
                .from('user_roles')
                .insert({
                    user_id: profile.id,
                    role: 'agent'
                });

            if (insertError) {
                console.error(`  ❌ ${profile.full_name} - Error:`, insertError.message);
            } else {
                console.log(`  ✅ ${profile.full_name} - agent role assigned`);
                created++;
            }
        }

        console.log(`\n🎉 Done! Created ${created} new agent roles`);
        console.log(`\nNext steps:`);
        console.log(`1. Go to Admin Dashboard`);
        console.log(`2. Click "Request Leads"`);
        console.log(`3. Click "Distribute Leads to Agents"`);

    } catch (error) {
        console.error('Error:', error);
    }
}

createAgentRoles();
