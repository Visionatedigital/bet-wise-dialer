-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  start_date DATE,
  end_date DATE,
  target_calls INTEGER DEFAULT 0,
  target_conversions INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  total_deposits NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
CREATE POLICY "Users can view their own campaigns"
  ON public.campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON public.campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
  ON public.campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Add campaign_id to leads table
ALTER TABLE public.leads ADD COLUMN campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_leads_campaign_id ON public.leads(campaign_id);

-- Add campaign_id to call_activities table
ALTER TABLE public.call_activities ADD COLUMN campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_call_activities_campaign_id ON public.call_activities(campaign_id);

-- Create trigger for updated_at on campaigns
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update campaign statistics
CREATE OR REPLACE FUNCTION public.update_campaign_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  camp_id UUID;
BEGIN
  -- Determine campaign_id based on operation
  IF TG_OP = 'DELETE' THEN
    camp_id := OLD.campaign_id;
  ELSE
    camp_id := NEW.campaign_id;
  END IF;

  -- Skip if no campaign assigned
  IF camp_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Update campaign statistics
  UPDATE public.campaigns
  SET
    total_leads = (
      SELECT COUNT(*) 
      FROM public.leads 
      WHERE campaign_id = camp_id
    ),
    total_calls = (
      SELECT COUNT(*) 
      FROM public.call_activities 
      WHERE campaign_id = camp_id
    ),
    total_conversions = (
      SELECT COUNT(*) 
      FROM public.call_activities 
      WHERE campaign_id = camp_id 
        AND status = 'converted'
    ),
    total_deposits = (
      SELECT COALESCE(SUM(deposit_amount), 0)
      FROM public.call_activities 
      WHERE campaign_id = camp_id
    ),
    updated_at = now()
  WHERE id = camp_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger on leads table to update campaign stats
CREATE TRIGGER update_campaign_stats_on_leads
  AFTER INSERT OR UPDATE OR DELETE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaign_stats();

-- Trigger on call_activities table to update campaign stats
CREATE TRIGGER update_campaign_stats_on_calls
  AFTER INSERT OR UPDATE OR DELETE ON public.call_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaign_stats();