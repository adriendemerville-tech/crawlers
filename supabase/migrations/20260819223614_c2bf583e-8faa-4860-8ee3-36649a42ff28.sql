-- La table des synthèses réseau n'avait aucun droit d'accès : ni les comptes
-- authentifiés (lecture de l'historique) ni le backend (écriture) ne pouvaient
-- l'atteindre, la persistance échouait donc silencieusement.
GRANT SELECT ON public.marina_network_syntheses TO authenticated;
GRANT ALL ON public.marina_network_syntheses TO service_role;

-- La politique existante couvre déjà « chacun ne voit que ses propres lignes ».
-- L'écriture est réservée au backend, aucune policy d'insertion cliente.

-- Ligne de test technique laissée par la vérification d'écriture.
DELETE FROM public.marina_network_syntheses WHERE domain = 'test-audit.invalid';