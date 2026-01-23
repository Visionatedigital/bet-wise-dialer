import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAgentRoles() {
    try {
        console.log('=== Setting Up Agent Roles ===\n');

        // Get all auth users
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

        if (authError) {
            console.error('Error fetching auth users:', authError);
            return;
        }

        const authUsers = authData.users;
        console.log(`Found ${authUsers.length} auth users\n`);

        // Get existing profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email');

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            return;
        }

        console.log(`Found ${profiles?.length || 0} existing profiles\n`);

        // Create profiles for users that don't have them
        console.log('📝 Creating missing profiles...\n');
        let profilesCreated = 0;

        for (const user of authUsers) {
            const existingProfile = profiles?.find(p => p.id === user.id);

            if (!existingProfile) {
                // Extract name from email or use email
                const fullName = user.user_metadata?.full_name ||
                    user.email?.split('@')[0] ||
                    'User';

                const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        full_name: fullName,
                        email: user.email
                    });

                if (insertError) {
                    console.error(`  ❌ Failed to create profile for ${user.email}:`, insertError.message);
                } else {
                    console.log(`  ✅ Created profile for ${user.email} (${fullName})`);
                    profilesCreated++;
                }
            } else {
                console.log(`  ✓ Profile exists for ${user.email} (${existingProfile.full_name})`);
            }
        }

        console.log(`\n📊 Created ${profilesCreated} new profiles\n`);

        // Now assign agent roles to all users
        console.log('👥 Assigning agent roles...\n');

        const { data: existingRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id, role');

        if (rolesError) {
            console.error('Error fetching roles:', rolesError);
            return;
        }

        let rolesCreated = 0;

        for (const user of authUsers) {
            const hasAgentRole = existingRoles?.some(r =>
                r.user_id === user.id && r.role === 'agent'
            );

            if (!hasAgentRole) {
                const { error: insertError } = await supabase
                    .from('user_roles')
                    .insert({
                        user_id: user.id,
                        role: 'agent'
                    });

                if (insertError) {
                    console.error(`  ❌ Failed to assign agent role to ${user.email}:`, insertError.message);
                } else {
                    console.log(`  ✅ Assigned agent role to ${user.email}`);
                    rolesCreated++;
                }
            } else {
                console.log(`  ✓ ${user.email} already has agent role`);
            }
        }

        console.log(`\n🎉 Setup Complete!`);
        console.log(`   Profiles created: ${profilesCreated}`);
        console.log(`   Agent roles assigned: ${rolesCreated}`);
        console.log(`\n📋 Next Steps:`);
        console.log(`   1. Go to Admin Dashboard`);
        console.log(`   2. Click "Request Leads" to import leads`);
        console.log(`   3. Click "Distribute Leads to Agents" to assign leads`);

    } catch (error) {
        console.error('Error:', error);
    }
}

setupAgentRoles();
