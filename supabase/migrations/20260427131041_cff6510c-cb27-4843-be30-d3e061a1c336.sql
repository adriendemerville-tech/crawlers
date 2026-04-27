-- Cleanup orphan tracked_site for iktracker.fr
-- ─────────────────────────────────────────────
-- Le tracked_site 3c6c9ea6-cb34-404e-9ff2-8a9b09e30a8f appartient au user_id
-- 99008036-eee9-4dfa-9fe1-757c2fa48baf qui n'a ni profil ni compte auth.users.
-- Audit complet : 25 lignes orphelines réparties sur 3 tables auxiliaires
-- (site_taxonomy=19, backlink_snapshots=4, serp_snapshots=2). Aucune donnée
-- critique (pas de cms_connections, pas de scripts injectés, pas d'audits actifs).
-- 3 autres tracked_sites pour iktracker.fr restent intacts (3 users légitimes).

DO $$
DECLARE
  orphan_id constant uuid := '3c6c9ea6-cb34-404e-9ff2-8a9b09e30a8f';
  ts_exists boolean;
BEGIN
  -- Garde-fou : ne rien faire si l'ID n'existe plus (idempotence)
  SELECT EXISTS(SELECT 1 FROM public.tracked_sites WHERE id = orphan_id) INTO ts_exists;
  IF NOT ts_exists THEN
    RAISE NOTICE 'Orphan tracked_site % already cleaned up — skipping.', orphan_id;
    RETURN;
  END IF;

  -- Garde-fou : ne supprimer que si le user n'existe vraiment plus
  IF EXISTS(SELECT 1 FROM auth.users WHERE id = '99008036-eee9-4dfa-9fe1-757c2fa48baf')
     OR EXISTS(SELECT 1 FROM public.profiles WHERE user_id = '99008036-eee9-4dfa-9fe1-757c2fa48baf') THEN
    RAISE EXCEPTION 'User 99008036… exists — aborting cleanup.';
  END IF;

  -- Suppression des données auxiliaires
  DELETE FROM public.site_taxonomy      WHERE tracked_site_id = orphan_id;
  DELETE FROM public.backlink_snapshots WHERE tracked_site_id = orphan_id;
  DELETE FROM public.serp_snapshots     WHERE tracked_site_id = orphan_id;

  -- Suppression du tracked_site lui-même
  DELETE FROM public.tracked_sites WHERE id = orphan_id;

  RAISE NOTICE 'Cleaned up orphan tracked_site % and 25 auxiliary rows.', orphan_id;
END $$;