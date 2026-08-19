GRANT ALL ON public.domain_authority_snapshots TO service_role;
ALTER TABLE public.domain_authority_snapshots ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='domain_authority_snapshots' AND policyname='Admins can read authority snapshots') THEN
    CREATE POLICY "Admins can read authority snapshots" ON public.domain_authority_snapshots
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
GRANT SELECT ON public.domain_authority_snapshots TO authenticated;