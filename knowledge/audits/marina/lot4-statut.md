# Lot 4 — Réconciliation des compteurs et clamp des scores (2026-08-17)

Module : `supabase/functions/_shared/auditReconciliation.ts` (0 token LLM, 0 requête DB).

| Défaut | Correctif | Emplacement |
|---|---|---|
| Score « 55/50 » | `clampScore` / `scoreOn100` bornent tout score à son maximum déclaré | tuiles « Détail des scores » de Marina |
| Périmètre incohérent | `resolvePerimeter` : source unique crawlées / découvertes / sitemap + couverture + phrase réutilisable | `buildReportIntroHTML` (« Portée et limites ») |
| Orphelines contradictoires | `resolveOrphanCount` : le graphe cocoon fait foi ; `reconcileReportHtml` réécrit tout autre chiffre dans le HTML compilé | fin de phase 4 |
| « Profil de liens sain, aucun désaveu » face à une toxicité mesurée | `resolveToxicity` + réécriture des affirmations interdites dès toxicité >= 35 ou verdict `a_surveiller` / `pollue` | fin de phase 4 |
| Arrondis divergents (22 vs 22,1 ; 3 899 vs 3 800) | `roundPosition`, `roundVolume`, `formatVolume` | module partagé, à consommer par les sections mots-clés |
| Carte d'identité non résolue utilisée comme fait | `assessIdentityUsability` : notes explicites d'hypothèse, jamais un référentiel | phase 4 (journalisé) et bloc identité |

Fonction déployée : `marina`.

## Reste du plan

Lot 5 (déduplication par empreinte + sévérité calculée + owner/kpi/trafic), Lot 6 (éditorialisation du rendu), puis re-notation avec la grille consolidée (43/100 → cible 85-90).
