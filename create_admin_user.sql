-- ============================================
-- Script to Create Admin User Manually
-- ============================================
-- This script creates a new admin user in Supabase without requiring login
-- 
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Replace the placeholders below with your desired values:
--    - 'admin@example.com' → Your admin email
--    - 'YourPassword123!' → Your desired password (must be strong)
--    - 'Admin User' → Full name for the admin
-- 3. Run this script
-- ============================================

-- Step 1: Create the user in auth.users using Supabase's auth extension
-- Note: This requires using the auth.users table directly
DO $$
DECLARE
  new_user_id UUID;
  user_email TEXT := 'admin@example.com';  -- CHANGE THIS
  user_password TEXT := 'YourPassword123!'; -- CHANGE THIS (must be strong)
  user_full_name TEXT := 'Admin User';       -- CHANGE THIS
BEGIN
  -- Create user in auth.users
  -- Note: We need to use the auth schema's user creation function
  -- Since we can't directly insert into auth.users, we'll use a workaround
  
  -- First, try to create user via Supabase Auth Admin API (recommended)
  -- OR use the SQL function if available in your Supabase instance
  
  -- Alternative: Use Supabase Dashboard → Authentication → Add User
  -- Then run the steps below to set role and approve
  
  RAISE NOTICE 'User creation in auth.users must be done via Supabase Dashboard or Admin API';
  RAISE NOTICE 'After creating the user, run the SQL below to set admin role and approve';
END $$;

-- ============================================
-- Step 2: After creating user via Dashboard/API, run this:
-- ============================================
-- Replace 'admin@example.com' with the email you used to create the user

-- Approve the user profile
UPDATE public.profiles 
SET approved = true, 
    updated_at = now(),
    full_name = COALESCE(full_name, 'Admin User')  -- Update if null
WHERE email = 'admin@example.com';  -- CHANGE THIS to your admin email

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

-- ============================================
-- ALTERNATIVE: Complete Script (if you have direct access)
-- ============================================
-- If you have service role access, you can use this complete version:

/*
-- This version assumes you can use extensions or have admin access
-- Uncomment and modify as needed

DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
  user_email TEXT := 'admin@example.com';
  user_password TEXT := 'YourPassword123!';
  user_full_name TEXT := 'Admin User';
BEGIN
  -- Insert into auth.users (requires service role or admin access)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',  -- Your instance ID
    user_email,
    crypt(user_password, gen_salt('bf')),  -- Hash password
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', user_full_name),
    false,
    'authenticated'
  );

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, approved)
  VALUES (new_user_id, user_email, user_full_name, true)
  ON CONFLICT (id) DO UPDATE
  SET approved = true, full_name = user_full_name;

  -- Add admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Admin user created with ID: %', new_user_id;
END $$;
*/

