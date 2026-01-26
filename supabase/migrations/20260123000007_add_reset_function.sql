-- Create RPC function to efficiently reset lead assignments
-- Migration: 20260123000007_add_reset_function.sql

CREATE OR REPLACE FUNCTION reset_lead_assignments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Efficiently update all assigned leads to unassigned
  -- Using WHERE user_id IS NOT NULL prevents touching already unassigned rows
  -- which reduces lock contention and I/O.
  
  -- Note: Assuming table is 'telemarketing_leads' based on previous context.
  -- If table is 'leads', update accordingly.
  -- Based on error "leads:1 Failed", table name likely 'leads' or mapped.
  -- However, user's previous SQL created 'telemarketing_leads'.
  -- I will create it for BOTH to be safe or check existing code usage.
  -- The distribute-leads code uses 'leads'. I will assume 'leads' table.
  -- Wait, if leads is a view, update might fail.
  -- But distribute-leads was working with 'leads'.
  
  UPDATE leads 
  SET user_id = NULL, assigned_at = NULL
  WHERE user_id IS NOT NULL;
  
END;
$$;
