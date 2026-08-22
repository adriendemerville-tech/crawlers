ALTER TABLE public.marketplace_link_assets
  ADD COLUMN IF NOT EXISTS seller_veto_dofollow boolean NOT NULL DEFAULT false;

ALTER TABLE public.marketplace_matches
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL;