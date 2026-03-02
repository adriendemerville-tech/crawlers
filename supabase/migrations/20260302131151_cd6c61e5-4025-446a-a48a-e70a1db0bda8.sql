
-- Table de bibliothèque de solutions éprouvées
CREATE TABLE public.solution_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  error_type TEXT NOT NULL,
  technology_context TEXT DEFAULT '',
  target_selector_context TEXT DEFAULT '',
  code_snippet TEXT NOT NULL,
  success_rate NUMERIC DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  is_generic BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'seo',
  priority TEXT DEFAULT 'important',
  label TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.solution_library ENABLE ROW LEVEL SECURITY;

-- Solutions are readable by all authenticated users (shared library)
CREATE POLICY "Authenticated users can view solutions"
ON public.solution_library
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can insert/update/delete solutions directly
-- (Edge functions use service role key to bypass RLS)
CREATE POLICY "Admins can manage solutions"
ON public.solution_library
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast lookup
CREATE INDEX idx_solution_library_error_type ON public.solution_library(error_type);
CREATE INDEX idx_solution_library_category ON public.solution_library(category);
CREATE INDEX idx_solution_library_technology_context ON public.solution_library(technology_context);

-- Trigger for updated_at
CREATE TRIGGER update_solution_library_updated_at
BEFORE UPDATE ON public.solution_library
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
