
## #139 · P0 · 2j — Bypass total RLS sur les tables audits et SEO
Ajouter `TO service_role` ou `USING (auth.role() = 'service_role')` aux politiques "Service role full access" qui utilisent actuellement `USING (true)`.

## #140 · P0 · 1j — Appel LLM hors Gateway dans audit-compare
Remplacer le `fetch` direct vers OpenRouter par `aiGatewayFetch` pour garantir le tracking des coûts et l'observabilité.

## #141 · P1 · 5j — Duplication massive de logique (audit-expert-seo vs expert-audit)
Fusionner les deux edge functions de ~2500 lignes pour réduire la dette technique et les risques d'incohérence fonctionnelle.

## #142 · P1 · 2j — Absence de safeServiceCall pour vérification de propriété
Encapsuler les traitements d'audit dans `safeServiceCall` pour valider que l'utilisateur est bien propriétaire du `tracked_site_id` concerné.

## #143 · P1 · 1j — GRANTs manquants pour authenticated
Ajouter les `GRANT` explicites aux utilisateurs authentifiés sur les tables SEO pour éviter les erreurs 403 après correction du RLS.

## #144 · P2 · 1j — Non-conformité Design System et console.log
Remplacer les couleurs HSL/Tailwind hardcodées par les variables du Design System et supprimer les `console.log` de production.

## #145 · P2 · 1j — Risque de timeout edge (60s)
Optimiser la parallélisation des appels API tiers et durcir les timeouts internes pour éviter d'atteindre la limite des 60s des edge functions.
