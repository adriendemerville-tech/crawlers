# Marina — Funnel public (essai gratuit, pass 15 €, liens courts, multipages)

Doc technique du parcours public de `/marina` : audit sans compte, déblocage payant à l'unité,
partage de rapport par lien court et regroupement des audits multipages.

Dernière mise à jour : 2026-08-19.

---

## 1. Essai gratuit sans compte

Fichiers : `src/lib/marinaFree.functions.ts`, `src/lib/marinaFree.constants.ts`.

- Quota : `MARINA_FREE_QUOTA = 2` rapports complets **par adresse IP** et **par email**.
- Toute la logique de quota est serveur (`createServerFn`) ; le client n'affiche que le compteur.
- L'IP n'est **jamais** stockée en clair : empreinte `SHA-256` salée (`marina-free:<pepper>:<ip>`),
  le pepper dérive d'une clé serveur. IP lue dans l'ordre `x-forwarded-for` → `cf-connecting-ip` → `x-real-ip`.
- Email obligatoire : capture de lead + second garde-fou anti-abus (validation regex, max 160 caractères).
- URL normalisée avant lancement (schéma http/https forcé, hostname avec point obligatoire).
- Table : `marina_free_trials` (`ip_hash`, `email`, job lié). Écriture via `supabaseAdmin` côté serveur uniquement.

Server functions exposées :

| Fonction | Méthode | Rôle |
| --- | --- | --- |
| `getMarinaFreeQuota` | GET | renvoie `{ quota, used, remaining }` pour l'IP courante |
| `startMarinaFreeAudit` | POST | valide URL + email, vérifie les deux quotas, lance le job Marina |

Codes d'erreur retournés (jamais d'exception côté client) : `invalid_url`, `invalid_email`, `quota_exhausted`.
Message de sortie de quota : invitation à créer un compte (5 crédits offerts = 1 rapport).

## 2. Déblocage payant à l'unité (15 €)

Fichier UI : `src/components/Marina/MarinaPaidUnlockModal.tsx` (`MARINA_ONESHOT_PRICE_EUR = 15`).

- Une fois les 2 essais consommés, la modale propose l'audit suivant à 15 €.
- Le paiement (Stripe) crée un **pass à usage unique** côté serveur : table `marina_paid_passes`.
- Consommation du pass : côté serveur au lancement du job, jamais depuis le client.
- Webhooks concernés : `supabase/functions/stripe-webhook`, `stripe-actions`, `payments-webhook`.

## 3. Liens courts de rapport

- Route : `src/routes/m.$code.ts` → `/m/<code>`, déléguée à `src/lib/marina/serveReport.server.ts`.
- `code` = préfixe de l'identifiant du rapport (8 caractères suffisent) ou identifiant complet.
- Remplace l'URL signée Storage, illisible à partager.
- `/r/$shareId` reste réservé aux rapports partagés historiques ; la redirection legacy est gérée
  dans `SharedReportRedirect` pour éviter la collision de routes et les erreurs CORS.

## 4. Regroupement des audits multipages

Fichier : `src/components/Marina/MarinaMyAuditsTab.tsx`.

- L'edge function `marina` persiste `batch_id`, `batch_size`, `batch_index` dans le payload du job.
- Le tab « Mes audits » regroupe par `batchId` : **une seule carte et un seul bouton** par lot,
  badge « Multipages · N pages » et score moyen consolidé.
- Repli pour les lots historiques sans `batchId` : même domaine et lancement dans une fenêtre de 5 minutes.
- Le bouton « Voir le rapport » cible le rapport principal du lot (`main`).

## 5. Invariants à respecter

- Quotas et passes : décision **exclusivement serveur**, aucune valeur de confiance venant du client.
- Aucune IP en clair en base ; toujours l'empreinte salée.
- Pas de nouvelle carte par page d'un lot multipages : le regroupement par `batchId` est la règle.
- Les liens de partage restent courts (`/m/<code>`) ; ne pas réintroduire d'URL signée dans l'UI.
