UPDATE public.tracked_sites
SET 
  market_sector = 'Indemnités kilométriques, frais de déplacement professionnel et conformité fiscale URSSAF',
  target_audience = 'Salariés utilisant leur véhicule personnel (frais réels), auto-entrepreneurs, indépendants, TPE/PME gérant les notes de frais kilométriques, comptables',
  products_services = 'Calculateur d''indemnités kilométriques (barème fiscal), suivi GPS de trajets professionnels, export PDF pour déclaration d''impôts, gestion de notes de frais, conformité URSSAF'
WHERE domain ILIKE '%iktracker%';