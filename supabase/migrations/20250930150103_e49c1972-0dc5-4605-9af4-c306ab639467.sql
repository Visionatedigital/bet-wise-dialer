-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('dormant', 'semi-active', 'vip')),
  last_activity TEXT,
  last_deposit_ugx NUMERIC DEFAULT 0,
  last_bet_date DATE,
  intent TEXT,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  next_action TEXT,
  next_action_due TIMESTAMP WITH TIME ZONE,
  campaign TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  sla_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policies for leads
CREATE POLICY "Users can view their own leads"
ON public.leads
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own leads"
ON public.leads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads"
ON public.leads
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads"
ON public.leads
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_leads_user_id ON public.leads(user_id);
CREATE INDEX idx_leads_segment ON public.leads(segment);
CREATE INDEX idx_leads_campaign ON public.leads(campaign);
CREATE INDEX idx_leads_priority ON public.leads(priority);