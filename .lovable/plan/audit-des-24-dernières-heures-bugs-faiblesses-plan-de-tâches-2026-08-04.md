# Audit des 24 dernières heures — bugs, faiblesses, plan de tâches

Périmètre analysé : commits du 03/08 18h au 04/08 06h (bascule image OpenRouter, garde anti-cannibalisation, exécuteur de pruning, exécuteur CMS interne crawlers.fr, correctif Breathing Spiral), plus l'état réel en base (Parménion, files de jobs, crons, usage LLM).

## Ce qui fonctionne réellement

- crawlers.fr : cycle 45 complet, 1 article publié dans le CMS interne avec image, URL en ligne.
- iktracker.fr : cycles horaires qui vont jusqu'à `execute completed` + `validate completed`.
- Pruning : séquence snapshot → fusion → 301 → suppression correctement bloquante, `dry_run` respecté, `restore` opérationnel, cap 4 cohérent des deux côtés.
- Clustering workbench : fonction et trigger en place, SECURITY DEFINER correctement verrouillé.

## Bugs bloquants (P0)

1. **dictadevi.io est gelé depuis 30 h.** Dernière décision : 03/08 07:04, une décision `audit` restée en `planned`, config `status='running'` jamais libérée. Aucun cycle depuis. Cause probable : garde « cycle en vol » qui ne réconcilie pas un `running` orphelin.
2. **iktracker.fr tourne avec deux configs Autopilot actives en parallèle** (deux `tracked_sites` et deux comptes différents, cooldown 1 h et 0 h, séries de cycles 241 et 331). Deux pipelines concurrents sur le même domaine : doublons de contenu possibles, coût LLM doublé, cannibalisation auto-générée.
3. **Le pruning ne peut pas fonctionner sur crawlers.fr.** `content-pruning-executor` route tout domaine hors iktracker/dictadevi vers `cms-patch-content` avec des actions (`get-post`/`update-post`/`delete-post`) que cette fonction n'implémente pas, et avec une auth service_role alors qu'elle exige un JWT utilisateur. La tâche `fix_cannibalization` échouera systématiquement sur le site pilote.
4. **`content-architecture-advisor` échoue en boucle** : 130 jobs `failed` (timeout signal, puis « CPU wall-time exceeded — auto-reaped »), un par heure, toujours avec le mot-clé générique `SEO` sur iktracker.fr. Cela dégrade chaque cycle en phase audit et brûle du CPU pour rien.
5. **Cron `compute-spiral-signals-6h` probablement muet.** Le body est correct (`{"all": true}`) mais l'en-tête dépend de `current_setting('app.settings.service_role_key', true)` — ce paramètre est absent côté base, donc l'en-tête devient `Bearer ` et la fonction répond 401 (`getAuthenticatedUser` → Unauthorized). Les signaux de spirale ne sont donc toujours pas rafraîchis.

## Faiblesses (P1)

6. **Coûts LLM non tracés depuis la bascule OpenRouter** : dernière ligne de `ai_gateway_usage` = 03/08 07:06, alors que des dizaines de cycles ont tourné depuis. Perte d'observabilité et de contrôle du budget.
7. **Identifiant de modèle image douteux** : `google/gemini-3.1-flash-image`. À valider par un appel réel ; sinon la génération d'images repose en permanence sur le fallback.
8. **117 tâches workbench sur 171 sans cluster.** Le cap « 2 items par cluster » ne s'applique donc qu'à un tiers du backlog ; les items techniques partagent une partition nulle.
9. **Décisions `prescribe` orphelines** : 3 décisions `planned` anciennes et 13 `skipped_stale` en 30 h. Quand l'invocation est coupée côté client, la phase `execute` n'est jamais enfilée — le cycle est perdu en silence.
10. **Auto-publication crawlers.fr trop permissive** : seul garde-fou avant `status: 'published'` = 200 caractères de contenu. Aucun contrôle de longueur réaliste ni anti-doublon de titre.
11. **Écriture non atomique du slug** : lecture puis insert/update séparés alors que `blog_articles.slug` porte un index unique — un cycle concurrent produit une erreur 409 non gérée au lieu d'un upsert.

## Imprécisions (P2)

12. `pruningCandidate` est choisi sur l'ensemble des clusters, pas sur les clusters saturés : un slot de cycle peut être consommé par une tâche de pruning sans doublon exploitable.
13. Erreurs avalées sans compteur : fallback méta et échec de génération d'image ne remontent ni dans `phaseErrors` ni dans un agrégat supervisable.
14. Documentation fausse : la mémoire pointe `_shared/parmenion/cannibalizationClusters.ts` alors que le module est dans `_shared/cannibalizationClusters.ts` ; la note « Spiral Cluster Binding Fix » décrit une auth cron qui n'est pas celle réellement livrée.

## Plan de tâches proposé

### Lot A — débloquer la production (aujourd'hui)
- A1. Réconcilier les configs Autopilot `status='running'` bloquées depuis plus de 2 h (reset en `idle` + décision orpheline en `skipped_stale`), et relancer dictadevi.io.
- A2. Statuer sur les deux configs iktracker.fr : désactiver la doublon et remettre un cooldown ≥ 12 h sur celle conservée.
- A3. Neutraliser `content-architecture-advisor` dans la phase audit (skip après 3 échecs consécutifs, timeout dur, mot-clé réel au lieu de « SEO ») pour arrêter la boucle d'échecs.
- A4. Corriger l'auth du cron `compute-spiral-signals-6h` (secret service_role réellement disponible) et vérifier un run.

### Lot B — fiabiliser les nouveautés (48 h)
- B1. Ajouter un bridge interne `crawlers.fr` dans `content-pruning-executor` (lecture/écriture directe `blog_articles`) et rejouer un dry-run de pruning sur crawlers.fr.
- B2. Restaurer le tracking des coûts LLM sur le chemin OpenRouter (insertion dans `ai_gateway_usage`).
- B3. Valider le slug du modèle image par un appel réel ; renommer `generateImagen3`/`provider: 'imagen3'` en cohérence avec le provider effectif.
- B4. Passer la publication interne en `upsert(onConflict: 'slug')` et relever le seuil de contenu publiable (800 caractères) + contrôle anti-doublon de titre.

### Lot C — qualité du moteur (1 semaine)
- C1. Reprise automatique des décisions `planned` de plus de 30 min : enfiler la phase `execute` au lieu de les laisser expirer.
- C2. Filtrer `pruningCandidate` sur les clusters saturés uniquement.
- C3. Assigner un cluster (ou une lane explicite) aux items techniques du workbench pour rendre le cap de diversité effectif partout.
- C4. Compteurs d'échecs non bloquants (image, fallback méta) exposés dans `execution_results` et l'admin.
- C5. Corriger les deux notes mémoire inexactes.

## Détails techniques

- Fichiers concernés : `supabase/functions/autopilot-engine/index.ts`, `supabase/functions/content-pruning-executor/index.ts`, `supabase/functions/parmenion-orchestrator/index.ts`, `supabase/functions/_shared/imageGeneration.ts`, `supabase/functions/compute-spiral-signals/index.ts`, migration cron du 04/08.
- Tables concernées : `autopilot_configs`, `parmenion_decision_log`, `async_jobs`, `architect_workbench`, `blog_articles`, `ai_gateway_usage`, `content_pruning_log`.
- Aucune modification de schéma nécessaire hors migration de réconciliation (A1/A2) et correctif de cron (A4).
