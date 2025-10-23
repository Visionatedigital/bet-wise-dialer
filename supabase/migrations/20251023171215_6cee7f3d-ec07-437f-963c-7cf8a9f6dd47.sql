-- Update the handle_new_user function to read role from user metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_role text;
begin
  -- Insert profile
  insert into public.profiles (id, full_name, email, approved)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    false
  );
  
  -- Get role from metadata, default to 'agent' if not specified
  user_role := coalesce(new.raw_user_meta_data->>'role', 'agent');
  
  -- Insert user role
  insert into public.user_roles (user_id, role)
  values (new.id, user_role::app_role);
  
  return new;
end;
$$;