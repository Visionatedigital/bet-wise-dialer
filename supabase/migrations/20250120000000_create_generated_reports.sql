-- Create generated_reports table to store performance reports
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_title TEXT NOT NULL,
  report_content TEXT NOT NULL,
  date_range TEXT NOT NULL,
  selected_agent TEXT,
  agent_name TEXT,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
  ON public.generated_reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- Managers can view reports from their team
CREATE POLICY "Managers can view team reports"
  ON public.generated_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = generated_reports.user_id
      AND profiles.manager_id = auth.uid()
    )
  );

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
  ON public.generated_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'moderator')
    )
  );

-- Users can insert their own reports
CREATE POLICY "Users can insert their own reports"
  ON public.generated_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reports
CREATE POLICY "Users can delete their own reports"
  ON public.generated_reports
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_generated_reports_user_id ON public.generated_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created_at ON public.generated_reports(created_at DESC);

