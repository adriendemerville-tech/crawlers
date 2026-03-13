
-- Add tracked_site_id to predictions for direct FK linkage
ALTER TABLE public.predictions
  ADD COLUMN tracked_site_id uuid REFERENCES public.tracked_sites(id) ON DELETE SET NULL;

-- Index for efficient joins
CREATE INDEX idx_predictions_tracked_site_id ON public.predictions(tracked_site_id);
