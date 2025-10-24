-- Clear all leads to start fresh with the new import
DELETE FROM public.leads;

-- Reset campaign stats since we cleared leads
UPDATE public.campaigns
SET total_leads = 0,
    total_calls = 0,
    total_conversions = 0,
    total_deposits = 0
WHERE id IS NOT NULL;