
-- Create conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.conversations FOR DELETE USING (auth.uid() = user_id);

-- Messages policies (through conversation ownership)
CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create messages in own conversations" ON public.messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete messages in own conversations" ON public.messages FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND user_id = auth.uid())
);

-- Indexes
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
