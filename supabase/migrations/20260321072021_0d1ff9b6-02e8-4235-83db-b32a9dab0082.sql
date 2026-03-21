-- Table de scoring qualité SAV pour boucle d'amélioration continue
CREATE TABLE public.sav_quality_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.sav_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Signaux de qualité
  message_count INTEGER NOT NULL DEFAULT 0,
  repeated_intent_count INTEGER NOT NULL DEFAULT 0,  -- même motif détecté N fois
  escalated_to_phone BOOLEAN NOT NULL DEFAULT false,
  user_thumbs_up BOOLEAN DEFAULT NULL,  -- feedback explicite optionnel
  
  -- Navigation post-chat (rempli async par le frontend)
  post_chat_route TEXT DEFAULT NULL,  -- route visitée après fermeture du chat
  suggested_route TEXT DEFAULT NULL,  -- route suggérée par l'agent dans sa réponse
  route_match BOOLEAN DEFAULT NULL,  -- post_chat_route correspond à suggested_route
  post_chat_delay_seconds INTEGER DEFAULT NULL,  -- délai entre fermeture chat et navigation
  
  -- Score calculé
  precision_score INTEGER NOT NULL DEFAULT 50,  -- 0-100, calculé par l'algo
  -- Formule: base 50 + route_match(+30) + short_conv(+20) - repeated_intent(-20/each) - escalation(-50) ± thumbs(±40)

  -- Metadata
  detected_intent TEXT DEFAULT NULL,  -- intention principale détectée (navigation, score, credit, bug, etc.)
  intent_keywords TEXT[] DEFAULT NULL  -- mots-clés extraits pour détection de répétition
);

-- Enable RLS
ALTER TABLE public.sav_quality_scores ENABLE ROW LEVEL SECURITY;

-- Service role only (backend writes)
CREATE POLICY "Service role full access on sav_quality_scores"
  ON public.sav_quality_scores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read all scores
CREATE POLICY "Admins can read sav_quality_scores"
  ON public.sav_quality_scores
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for analytics queries
CREATE INDEX idx_sav_quality_scores_precision ON public.sav_quality_scores(precision_score);
CREATE INDEX idx_sav_quality_scores_user ON public.sav_quality_scores(user_id);
CREATE INDEX idx_sav_quality_scores_created ON public.sav_quality_scores(created_at DESC);