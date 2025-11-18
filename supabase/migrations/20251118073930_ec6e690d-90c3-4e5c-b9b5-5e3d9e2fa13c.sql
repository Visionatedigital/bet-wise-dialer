-- Normalize phone numbers in whatsapp_conversations table
-- Remove spaces and ensure + prefix
UPDATE whatsapp_conversations
SET contact_phone = CASE
  WHEN contact_phone LIKE '+%' THEN regexp_replace(contact_phone, '\s+', '', 'g')
  ELSE '+' || regexp_replace(contact_phone, '\s+', '', 'g')
END
WHERE contact_phone ~ '\s' OR contact_phone NOT LIKE '+%';