-- Create table for saved corrective codes
CREATE TABLE public.saved_corrective_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  code TEXT NOT NULL,
  fixes_applied JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.saved_corrective_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own corrective codes" 
ON public.saved_corrective_codes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own corrective codes" 
ON public.saved_corrective_codes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own corrective codes" 
ON public.saved_corrective_codes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own corrective codes" 
ON public.saved_corrective_codes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_saved_corrective_codes_updated_at
BEFORE UPDATE ON public.saved_corrective_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();