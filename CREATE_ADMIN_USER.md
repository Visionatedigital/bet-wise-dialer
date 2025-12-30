# How to Create an Admin User Manually in Supabase

This guide shows you how to create an admin user without logging into the application.

## Method 1: Using Supabase Dashboard (Recommended)

### Step 1: Create the User in Supabase Dashboard

1. Go to your **Supabase Dashboard**
2. Navigate to **Authentication** → **Users**
3. Click **"Add User"** or **"Create User"**
4. Fill in the details:
   - **Email**: `admin@example.com` (or your desired email)
   - **Password**: Choose a strong password
   - **Auto Confirm User**: ✅ Check this box (so they don't need email verification)
5. Click **"Create User"**

### Step 2: Set Admin Role and Approve User

1. Go to **SQL Editor** in Supabase Dashboard
2. Run this SQL script (replace `admin@example.com` with the email you used):

```sql
-- Approve the user profile
UPDATE public.profiles 
SET approved = true, 
    updated_at = now(),
    full_name = COALESCE(full_name, 'Admin User')
WHERE email = 'admin@example.com';  -- CHANGE THIS

-- Remove any existing roles for this user
DELETE FROM public.user_roles 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'admin@example.com');  -- CHANGE THIS

-- Add admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = 'admin@example.com'  -- CHANGE THIS
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the admin user was created
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.approved,
  array_agg(ur.role) as roles
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.email = 'admin@example.com'  -- CHANGE THIS
GROUP BY p.id, p.email, p.full_name, p.approved;
```

3. You should see a result showing the user with `roles: {admin}` and `approved: true`

---

## Method 2: Using Supabase Admin API (For Automation)

If you want to automate this or use it in a script, you can use the Supabase Admin API:

### Using curl:

```bash
# Set your Supabase URL and Service Role Key
SUPABASE_URL="https://your-project.supabase.co"
SERVICE_ROLE_KEY="your-service-role-key"

# Create user
curl -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "YourPassword123!",
    "email_confirm": true,
    "user_metadata": {
      "full_name": "Admin User"
    }
  }'

# Then run the SQL from Method 1, Step 2 to set role and approve
```

### Using JavaScript/TypeScript:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use SERVICE ROLE KEY, not anon key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Create user
const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
  email: 'admin@example.com',
  password: 'YourPassword123!',
  email_confirm: true,
  user_metadata: {
    full_name: 'Admin User'
  }
})

if (error) {
  console.error('Error creating user:', error)
} else {
  console.log('User created:', user.user.id)
  
  // Set admin role and approve
  await supabaseAdmin
    .from('profiles')
    .update({ approved: true })
    .eq('id', user.user.id)
  
  await supabaseAdmin
    .from('user_roles')
    .upsert({
      user_id: user.user.id,
      role: 'admin'
    })
}
```

---

## Method 3: Quick SQL Script (If User Already Exists)

If you already have a user created and just need to make them an admin:

```sql
-- Replace 'user@example.com' with the actual email
UPDATE public.profiles 
SET approved = true, updated_at = now()
WHERE email = 'user@example.com';

DELETE FROM public.user_roles 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'user@example.com');

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = 'user@example.com';
```

---

## Verification

After creating the admin user, verify it works:

1. Try logging in with the email and password you set
2. You should have access to admin features
3. Check the user in **Authentication** → **Users** in Supabase Dashboard
4. Verify the role in **Table Editor** → **user_roles** table

---

## Troubleshooting

### User can't log in
- Make sure `approved = true` in the `profiles` table
- Check that the user exists in `auth.users` table
- Verify email is correct

### User doesn't have admin access
- Check `user_roles` table has a row with `role = 'admin'` for that user
- Verify the role enum value is correct (should be `'admin'::app_role`)

### Profile doesn't exist
- The trigger should create it automatically, but if not:
```sql
INSERT INTO public.profiles (id, email, full_name, approved)
SELECT id, email, 'Admin User', true
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (id) DO UPDATE SET approved = true;
```

