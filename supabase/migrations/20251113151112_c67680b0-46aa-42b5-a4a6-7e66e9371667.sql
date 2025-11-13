-- Add phone_number_id and display_phone_number to whatsapp_conversations
ALTER TABLE whatsapp_conversations 
ADD COLUMN phone_number_id TEXT,
ADD COLUMN display_phone_number TEXT;