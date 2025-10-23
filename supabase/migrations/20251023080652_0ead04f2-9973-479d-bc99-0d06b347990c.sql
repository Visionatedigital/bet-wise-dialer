-- Add AI script and suggestions columns to existing campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS target_segment TEXT,
ADD COLUMN IF NOT EXISTS ai_script TEXT,
ADD COLUMN IF NOT EXISTS suggestions JSONB DEFAULT '[]'::jsonb;

-- Update existing campaigns with sample AI scripts
UPDATE public.campaigns 
SET 
  target_segment = 'new_players',
  ai_script = 'Your role is to help agents welcome new players to Betsure Uganda. Key points:
1. Greet warmly and introduce Betsure
2. Verify customer identity and get consent for data processing
3. Explain the welcome bonus (100% up to 100,000 UGX)
4. Guide through first deposit (MTN/Airtel Mobile Money)
5. Mention responsible gaming and 18+ requirement
6. Get recording consent at start of call',
  suggestions = '[
    {"type": "compliance", "trigger": "call_start", "message": "Start with: Hello! This call is being recorded for quality purposes. May I have your consent to proceed?"},
    {"type": "action", "trigger": "after_greeting", "message": "Ask: Have you created your Betsure account yet, or would you like help with that?"},
    {"type": "info", "trigger": "bonus_question", "message": "Welcome bonus: 100% match up to 100,000 UGX on first deposit"},
    {"type": "compliance", "trigger": "before_registration", "message": "Verify: Customer is 18+ and confirm data protection consent"},
    {"type": "action", "trigger": "deposit_discussion", "message": "Guide: We accept MTN Money and Airtel Money. Minimum deposit is 5,000 UGX"},
    {"type": "compliance", "trigger": "end_call", "message": "Remind: Please gamble responsibly. Set deposit limits if needed"}
  ]'::jsonb
WHERE name LIKE '%Welcome%' OR name LIKE '%New%';