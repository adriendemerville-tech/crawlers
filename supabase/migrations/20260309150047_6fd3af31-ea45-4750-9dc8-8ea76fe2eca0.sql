
CREATE TABLE public.patience_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_type text NOT NULL CHECK (card_type IN ('news', 'tip')),
  content text NOT NULL,
  relevance_score integer NOT NULL DEFAULT 50,
  freshness_score integer NOT NULL DEFAULT 100,
  category text NOT NULL DEFAULT 'seo',
  language text NOT NULL DEFAULT 'fr',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.patience_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active patience cards"
ON public.patience_cards
FOR SELECT
TO anon, authenticated
USING (is_active = true AND expires_at > now());
