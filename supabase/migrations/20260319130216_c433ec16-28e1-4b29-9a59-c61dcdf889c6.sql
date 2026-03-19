
ALTER TABLE public.prompt_matrix_items
  ADD COLUMN batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN batch_label TEXT NOT NULL DEFAULT 'Import';

CREATE INDEX idx_prompt_matrix_items_batch ON public.prompt_matrix_items(batch_id);
