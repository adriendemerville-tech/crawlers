
CREATE TABLE public.content_prompt_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  block_type TEXT NOT NULL DEFAULT 'custom',
  score NUMERIC DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.content_prompt_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prompt blocks"
  ON public.content_prompt_blocks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all prompt blocks"
  ON public.content_prompt_blocks FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own prompt blocks"
  ON public.content_prompt_blocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompt blocks"
  ON public.content_prompt_blocks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompt blocks"
  ON public.content_prompt_blocks FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_content_prompt_blocks_updated_at
  BEFORE UPDATE ON public.content_prompt_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_content_prompt_blocks_user_id ON public.content_prompt_blocks(user_id);
