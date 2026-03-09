
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
    console.error('Error: VITE_SUPABASE_SERVICE_ROLE_KEY is required to create users with admin privileges.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUser() {
    const email = 'test@bangbet.com';
    const password = 'Alwayswin26';
    const fullName = 'Test User';

    console.log(`\n=== Creating/Verifying Test User: ${email} ===\n`);

    try {
        // 1. Check if user exists first to just update if needed, or we can just try createUser and handle error
        // admin.createUser will return error if user exists.

        // We want to force the password and verify it.

        // Try to get user by email
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
            console.error('Error listing users:', listError);
            return;
        }

        const existingUser = users.find(u => u.email === email);

        if (existingUser) {
            console.log(`User already exists (ID: ${existingUser.id}). Updating password and verifying...`);

            const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
                existingUser.id,
                {
                    password: password,
                    email_confirm: true,
                    user_metadata: { full_name: fullName }
                }
            );

            if (updateError) {
                console.error('Error updating user:', updateError);
            } else {
                console.log('✅ User updated successfully!');
                console.log(`   Email: ${email}`);
                console.log(`   Password: ${password}`);
                console.log(`   ID: ${updateData.user.id}`);
            }

        } else {
            console.log('User does not exist. Creating new user...');

            const { data: createData, error: createError } = await supabase.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true,
                user_metadata: { full_name: fullName }
            });

            if (createError) {
                console.error('Error creating user:', createError);
            } else {
                console.log('✅ User created successfully!');
                console.log(`   Email: ${email}`);
                console.log(`   Password: ${password}`);
                console.log(`   ID: ${createData.user.id}`);
            }
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

createTestUser();
