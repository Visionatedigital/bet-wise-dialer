-- Create WhatsApp agent configuration table
CREATE TABLE public.agent_whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(phone_number_id)
);

-- Create WhatsApp conversations table
CREATE TABLE public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  last_message_text TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agent_id, contact_phone)
);

-- Create WhatsApp messages table
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  whatsapp_message_id TEXT UNIQUE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'user')),
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_whatsapp_config
CREATE POLICY "Agents can view their own WhatsApp config"
  ON public.agent_whatsapp_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage WhatsApp config"
  ON public.agent_whatsapp_config FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for whatsapp_conversations
CREATE POLICY "Agents can view their own conversations"
  ON public.whatsapp_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can update their own conversations"
  ON public.whatsapp_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = agent_id);

CREATE POLICY "System can insert conversations"
  ON public.whatsapp_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = agent_id);

-- RLS Policies for whatsapp_messages
CREATE POLICY "Agents can view messages in their conversations"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_conversations
      WHERE id = conversation_id AND agent_id = auth.uid()
    )
  );

CREATE POLICY "Agents can insert messages in their conversations"
  ON public.whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.whatsapp_conversations
      WHERE id = conversation_id AND agent_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_whatsapp_conversations_agent ON public.whatsapp_conversations(agent_id);
CREATE INDEX idx_whatsapp_conversations_contact ON public.whatsapp_conversations(contact_phone);
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_timestamp ON public.whatsapp_messages(timestamp DESC);

-- Enable realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- Create trigger to update updated_at
CREATE TRIGGER update_agent_whatsapp_config_updated_at
  BEFORE UPDATE ON public.agent_whatsapp_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();