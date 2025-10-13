-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own token" ON public.webrtc_tokens;
DROP POLICY IF EXISTS "Users can insert their own token" ON public.webrtc_tokens;
DROP POLICY IF EXISTS "Users can update their own token" ON public.webrtc_tokens;
DROP POLICY IF EXISTS "Users can delete their own token" ON public.webrtc_tokens;

-- Create table for storing WebRTC capability tokens (if not exists)
CREATE TABLE IF NOT EXISTS public.webrtc_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  token text NOT NULL,
  client_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webrtc_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view and manage their own tokens
CREATE POLICY "Users can view their own token"
  ON public.webrtc_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own token"
  ON public.webrtc_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own token"
  ON public.webrtc_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own token"
  ON public.webrtc_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_webrtc_tokens_user_id ON public.webrtc_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_webrtc_tokens_expires_at ON public.webrtc_tokens(expires_at);

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_webrtc_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.webrtc_tokens
  WHERE expires_at < now();
END;
$$;