-- Ensure whatsapp-media bucket exists and allows audio uploads (webm/ogg/etc)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true,
  20971520, -- 20 MB
  ARRAY[
    'image/*',
    'audio/ogg',
    'audio/webm',
    'audio/mpeg',
    'audio/mp4',
    'audio/3gpp',
    'audio/aac',
    'audio/opus',
    'audio/m4a',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Keep existing policies untouched; assume they are already configured for this bucket.
