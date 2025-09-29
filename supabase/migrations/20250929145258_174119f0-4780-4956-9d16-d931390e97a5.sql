-- Create call activities table to track individual calls
CREATE TABLE public.call_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_name TEXT,
  phone_number TEXT,
  call_type TEXT CHECK (call_type IN ('outbound', 'inbound', 'callback')) DEFAULT 'outbound',
  status TEXT CHECK (status IN ('connected', 'no_answer', 'busy', 'voicemail', 'disconnected', 'converted')) DEFAULT 'connected',
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  notes TEXT,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily metrics table for aggregated stats
CREATE TABLE public.daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  calls_made INTEGER DEFAULT 0,
  connects INTEGER DEFAULT 0,
  total_handle_time_seconds INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  total_deposit_value DECIMAL(10,2) DEFAULT 0,
  callbacks_due INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create callbacks table
CREATE TABLE public.callbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_name TEXT NOT NULL,
  phone_number TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'completed', 'missed', 'rescheduled')) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.call_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callbacks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_activities
CREATE POLICY "Users can view their own call activities" 
ON public.call_activities 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own call activities" 
ON public.call_activities 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call activities" 
ON public.call_activities 
FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for daily_metrics
CREATE POLICY "Users can view their own daily metrics" 
ON public.daily_metrics 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own daily metrics" 
ON public.daily_metrics 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily metrics" 
ON public.daily_metrics 
FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for callbacks
CREATE POLICY "Users can view their own callbacks" 
ON public.callbacks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own callbacks" 
ON public.callbacks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own callbacks" 
ON public.callbacks 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own callbacks" 
ON public.callbacks 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_call_activities_updated_at
BEFORE UPDATE ON public.call_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_metrics_updated_at
BEFORE UPDATE ON public.daily_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_callbacks_updated_at
BEFORE UPDATE ON public.callbacks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update daily metrics when call activities change
CREATE OR REPLACE FUNCTION public.update_daily_metrics()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  call_date DATE;
  user_uuid UUID;
BEGIN
  -- Determine the date and user for the operation
  IF TG_OP = 'DELETE' then
    call_date := OLD.start_time::DATE;
    user_uuid := OLD.user_id;
  ELSE
    call_date := NEW.start_time::DATE;
    user_uuid := NEW.user_id;
  END IF;

  -- Update or insert daily metrics
  INSERT INTO public.daily_metrics (user_id, date, calls_made, connects, total_handle_time_seconds, conversions, total_deposit_value)
  SELECT 
    user_uuid,
    call_date,
    COUNT(*) as calls_made,
    COUNT(*) FILTER (WHERE status = 'connected') as connects,
    COALESCE(SUM(duration_seconds), 0) as total_handle_time_seconds,
    COUNT(*) FILTER (WHERE status = 'converted') as conversions,
    COALESCE(SUM(deposit_amount), 0) as total_deposit_value
  FROM public.call_activities 
  WHERE user_id = user_uuid 
    AND start_time::DATE = call_date
  ON CONFLICT (user_id, date) 
  DO UPDATE SET
    calls_made = EXCLUDED.calls_made,
    connects = EXCLUDED.connects,
    total_handle_time_seconds = EXCLUDED.total_handle_time_seconds,
    conversions = EXCLUDED.conversions,
    total_deposit_value = EXCLUDED.total_deposit_value,
    updated_at = now();

  -- Update callbacks due count
  UPDATE public.daily_metrics 
  SET callbacks_due = (
    SELECT COUNT(*) 
    FROM public.callbacks 
    WHERE user_id = user_uuid 
      AND scheduled_for::DATE = call_date 
      AND status = 'pending'
  )
  WHERE user_id = user_uuid AND date = call_date;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to automatically update daily metrics
CREATE TRIGGER trigger_update_daily_metrics
AFTER INSERT OR UPDATE OR DELETE ON public.call_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_daily_metrics();

-- Create function to update callbacks due when callbacks change
CREATE OR REPLACE FUNCTION public.update_callbacks_due()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  callback_date DATE;
  user_uuid UUID;
BEGIN
  -- Determine the date and user for the operation
  IF TG_OP = 'DELETE' then
    callback_date := OLD.scheduled_for::DATE;
    user_uuid := OLD.user_id;
  ELSE
    callback_date := NEW.scheduled_for::DATE;
    user_uuid := NEW.user_id;
  END IF;

  -- Update callbacks due count in daily metrics
  INSERT INTO public.daily_metrics (user_id, date, callbacks_due)
  VALUES (
    user_uuid, 
    callback_date, 
    (SELECT COUNT(*) FROM public.callbacks WHERE user_id = user_uuid AND scheduled_for::DATE = callback_date AND status = 'pending')
  )
  ON CONFLICT (user_id, date) 
  DO UPDATE SET
    callbacks_due = (SELECT COUNT(*) FROM public.callbacks WHERE user_id = user_uuid AND scheduled_for::DATE = callback_date AND status = 'pending'),
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for callbacks
CREATE TRIGGER trigger_update_callbacks_due
AFTER INSERT OR UPDATE OR DELETE ON public.callbacks
FOR EACH ROW
EXECUTE FUNCTION public.update_callbacks_due();