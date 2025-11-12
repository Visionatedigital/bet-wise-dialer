-- Allow agents to delete their own WhatsApp conversations
DROP POLICY IF EXISTS "Agents can delete their own conversations" ON public.whatsapp_conversations;
CREATE POLICY "Agents can delete their own conversations"
ON public.whatsapp_conversations
FOR DELETE
USING (auth.uid() = agent_id);

-- Allow agents to delete messages in their own conversations
DROP POLICY IF EXISTS "Agents can delete messages in their conversations" ON public.whatsapp_messages;
CREATE POLICY "Agents can delete messages in their conversations"
ON public.whatsapp_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM whatsapp_conversations
    WHERE whatsapp_conversations.id = whatsapp_messages.conversation_id
      AND whatsapp_conversations.agent_id = auth.uid()
  )
);

-- Add foreign key constraint with CASCADE delete to ensure messages are deleted with conversation
ALTER TABLE public.whatsapp_messages
DROP CONSTRAINT IF EXISTS whatsapp_messages_conversation_id_fkey;

ALTER TABLE public.whatsapp_messages
ADD CONSTRAINT whatsapp_messages_conversation_id_fkey
FOREIGN KEY (conversation_id)
REFERENCES public.whatsapp_conversations(id)
ON DELETE CASCADE;