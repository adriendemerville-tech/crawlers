-- Add target_url column for storing analyzed URLs
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS target_url TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_url ON public.analytics_events(url);

-- Create a table for unique analyzed URLs
CREATE TABLE IF NOT EXISTS public.analyzed_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  first_analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  analysis_count INTEGER NOT NULL DEFAULT 1
);

-- Enable RLS
ALTER TABLE public.analyzed_urls ENABLE ROW LEVEL SECURITY;

-- Public read policy for admins
CREATE POLICY "Admins can view analyzed urls" 
ON public.analyzed_urls 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert/update (from edge functions)
CREATE POLICY "Service can manage analyzed urls" 
ON public.analyzed_urls 
FOR ALL
USING (true)
WITH CHECK (true);

-- Allow anonymous inserts for analytics tracking
DROP POLICY IF EXISTS "Authenticated users can insert analytics" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (true);

-- Allow admins to update support_messages for read_at
DROP POLICY IF EXISTS "Admins can update messages" ON public.support_messages;
CREATE POLICY "Admins can update messages" 
ON public.support_messages 
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = sender_id));