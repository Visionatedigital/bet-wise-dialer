-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for call recordings
CREATE POLICY "Allow authenticated users to upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'call-recordings');

CREATE POLICY "Allow authenticated users to read recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'call-recordings');

CREATE POLICY "Allow service role full access to recordings"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'call-recordings');
