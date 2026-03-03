
-- Table for agency clients
CREATE TABLE public.agency_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT,
  role TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Link table: client <-> tracked_site
CREATE TABLE public.agency_client_sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.agency_clients(id) ON DELETE CASCADE,
  tracked_site_id UUID NOT NULL REFERENCES public.tracked_sites(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, tracked_site_id)
);

-- RLS for agency_clients
ALTER TABLE public.agency_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their clients"
  ON public.agency_clients FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- RLS for agency_client_sites
ALTER TABLE public.agency_client_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage client sites"
  ON public.agency_client_sites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_clients ac
      WHERE ac.id = agency_client_sites.client_id
      AND ac.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_clients ac
      WHERE ac.id = agency_client_sites.client_id
      AND ac.owner_user_id = auth.uid()
    )
  );

-- Trigger for updated_at on agency_clients
CREATE TRIGGER update_agency_clients_updated_at
  BEFORE UPDATE ON public.agency_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
