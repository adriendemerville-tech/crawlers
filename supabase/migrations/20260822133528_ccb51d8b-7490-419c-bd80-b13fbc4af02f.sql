CREATE UNIQUE INDEX IF NOT EXISTS marketplace_ownership_verifications_uniq
  ON public.marketplace_ownership_verifications (user_id, domain, method);

CREATE INDEX IF NOT EXISTS marketplace_ownership_claims_user_domain_idx
  ON public.marketplace_ownership_claims (user_id, domain);