INSERT INTO public.excluded_ips (ip_address, label)
VALUES ('5.49.156.158', 'Poste admin (héritée du tableau de bord analytics)')
ON CONFLICT (ip_address) DO NOTHING;