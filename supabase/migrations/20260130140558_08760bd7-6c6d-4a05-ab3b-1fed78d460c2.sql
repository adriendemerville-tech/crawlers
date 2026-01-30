-- Table pour stocker le registre des recommandations d'audit (promptables pour le générateur de code correctif)
CREATE TABLE public.audit_recommendations_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  url TEXT NOT NULL,
  audit_type TEXT NOT NULL CHECK (audit_type IN ('technical', 'strategic')),
  
  -- Résumé promptable de la recommandation
  recommendation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'important', 'optional')),
  
  -- Données enrichies pour le générateur de code
  fix_type TEXT, -- Type de correction possible (ex: 'fix_title', 'fix_meta_desc', etc.)
  fix_data JSONB DEFAULT '{}'::jsonb, -- Données supplémentaires pour la correction
  prompt_summary TEXT NOT NULL, -- Résumé court utilisable dans un prompt LLM
  
  -- Métadonnées
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_audit_recommendations_user_domain ON public.audit_recommendations_registry (user_id, domain);
CREATE INDEX idx_audit_recommendations_unresolved ON public.audit_recommendations_registry (user_id, is_resolved) WHERE is_resolved = FALSE;

-- Enable Row Level Security
ALTER TABLE public.audit_recommendations_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own recommendations" 
ON public.audit_recommendations_registry 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recommendations" 
ON public.audit_recommendations_registry 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations" 
ON public.audit_recommendations_registry 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recommendations" 
ON public.audit_recommendations_registry 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_audit_recommendations_registry_updated_at
BEFORE UPDATE ON public.audit_recommendations_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();