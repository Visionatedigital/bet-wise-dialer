create or replace function bulk_assign_leads(payload jsonb)
returns void
language plpgsql
security definer
as $$
begin
  update leads as l
  set 
    user_id = (x.user_id)::uuid,
    assigned_at = (x.assigned_at)::timestamptz
  from jsonb_to_recordset(payload) as x(id uuid, user_id text, assigned_at text)
  where l.id = x.id;
end;
$$;
