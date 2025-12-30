-- Diagnostic: Check for leads with incorrect assignments
-- This query helps identify if there are leads assigned to wrong agents or unassigned leads

-- Check for leads that might be showing up incorrectly
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Count leads per agent
SELECT 
  p.id as agent_id,
  p.full_name as agent_name,
  p.email as agent_email,
  COUNT(l.id) as total_assigned_leads,
  COUNT(CASE WHEN NOT EXISTS (
    SELECT 1 FROM call_activities ca 
    WHERE ca.user_id = l.user_id AND ca.phone_number = l.phone
  ) THEN 1 END) as uncalled_leads
FROM profiles p
LEFT JOIN leads l ON l.user_id = p.id
WHERE EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'agent'
)
AND p.approved = true
GROUP BY p.id, p.full_name, p.email
ORDER BY total_assigned_leads DESC;

-- 2. Check for leads with null user_id (unassigned)
SELECT COUNT(*) as unassigned_leads_count
FROM leads
WHERE user_id IS NULL;

-- 3. Check for leads assigned to non-agent users
SELECT 
  l.id,
  l.name,
  l.user_id,
  p.full_name as assigned_to_name,
  p.email as assigned_to_email,
  array_agg(ur.role) as assigned_to_roles
FROM leads l
LEFT JOIN profiles p ON p.id = l.user_id
LEFT JOIN user_roles ur ON ur.user_id = l.user_id
WHERE l.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2 
    WHERE ur2.user_id = l.user_id AND ur2.role = 'agent'
  )
GROUP BY l.id, l.name, l.user_id, p.full_name, p.email
LIMIT 100;

-- 4. Check for duplicate phone numbers across different agents
SELECT 
  phone,
  COUNT(DISTINCT user_id) as assigned_to_agents,
  array_agg(DISTINCT user_id) as agent_ids,
  COUNT(*) as total_lead_records
FROM leads
WHERE user_id IS NOT NULL
GROUP BY phone
HAVING COUNT(DISTINCT user_id) > 1
ORDER BY total_lead_records DESC
LIMIT 50;

