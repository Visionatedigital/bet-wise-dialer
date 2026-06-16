import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();
console.log('Script initialized with dotenv');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const usersToCreate = [
  {
    email: 'admin.ghanaa@bangbet.com',
    password: 'GhanaPassword2026!',
    fullName: 'Ghana Admin',
    role: 'admin'
  },
  {
    email: 'manager.ghanaa@bangbet.com',
    password: 'GhanaPassword2026!',
    fullName: 'Ghana Manager',
    role: 'management'
  },
  {
    email: 'agent.ghanaa@bangbet.com',
    password: 'GhanaPassword2026!',
    fullName: 'Ghana Agent',
    role: 'agent'
  }
];

async function setupUser(userId: string, userData: any) {
  console.log(`  Setting up profile and role for ${userData.email}...`);
  
  // 2. Update Profile (Approved = true)
  // We'll use upsert to be safe, but update is fine if trigger created it
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      approved: true, 
      full_name: userData.fullName 
    })
    .eq('id', userId);

  if (profileError) {
    console.error(`    Error updating profile for ${userData.email}:`, profileError.message);
  } else {
    console.log(`    Profile updated and approved.`);
  }

  // 3. Set Role
  // First delete existing roles for this user to avoid conflicts if they existed
  await supabase.from('user_roles').delete().eq('user_id', userId);

  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({ 
      user_id: userId, 
      role: userData.role 
    });

  if (roleError) {
    console.error(`    Error setting role ${userData.role} for ${userData.email}:`, roleError.message);
  } else {
    console.log(`    Role ${userData.role} assigned.`);
  }
}

async function createUsers() {
  console.log('=== Creating Ghanaa Team Test Credentials ===\n');

  for (const userData of usersToCreate) {
    console.log(`Processing ${userData.role}: ${userData.email}...`);

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: { full_name: userData.fullName }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log(`  User ${userData.email} already exists in Auth. Checking profile...`);
        
        // Find existing user ID from profiles
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', userData.email)
          .single();

        if (profileData) {
          await setupUser(profileData.id, userData);
        } else {
          // If not in profiles, we might need to search auth.admin.listUsers
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existingUser = listData.users.find(u => u.email === userData.email);
          if (existingUser) {
            await setupUser(existingUser.id, userData);
          } else {
            console.error(`  Could not find user ID for ${userData.email} even though Auth says they exist.`);
          }
        }
      } else {
        console.error(`  Error creating auth user ${userData.email}:`, authError.message);
      }
      continue;
    }

    if (authData.user) {
      console.log(`  Auth user created: ${authData.user.id}`);
      await setupUser(authData.user.id, userData);
    }
  }

  console.log('\n=== Success ===');
  console.log('Credentials Summary:');
  usersToCreate.forEach(u => {
    console.log(`- ${u.role.toUpperCase()}: ${u.email} / ${u.password}`);
  });
}

createUsers().catch(console.error);
