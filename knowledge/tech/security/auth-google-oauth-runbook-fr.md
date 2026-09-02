# Runbook — Google OAuth « upstream request timeout »

Dernière mise à jour : 2026-09-02

## Symptôme

Le bouton « Connexion avec Google » (depuis `/tarifs`, `/auth`, etc.) tourne
indéfiniment. En ouvrant directement l'URL d'autorisation, le navigateur
affiche `upstream request timeout` :

```
https://<ref>.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fcrawlers.fr%2F
```

## Cause racine

Ce n'est **pas** un bug applicatif ni une mauvaise configuration du provider.
Le service d'authentification (GoTrue) n'arrive plus à joindre la découverte
OpenID de Google au moment de construire l'URL de consentement :

```
Get "https://accounts.google.com/.well-known/openid-configuration": context deadline exceeded
```

Signature typique dans les logs auth :

- `/authorize` → 504 (`request_timeout`) ou 400 (`validation_failed`, contexte annulé)
- `/admin/users` → 500 `unable to fetch records: context canceled`
- `/settings` lent (plusieurs secondes)

Le service est saturé/dégradé : l'egress réseau et les requêtes DB expirent.

## Diagnostic en 3 commandes

```bash
# 1. Le provider Google (configuré) doit répondre 302 en < 1 s
curl -s -o /dev/null -w "%{http_code} %{time_total}\n" --max-time 45 \
  "https://<ref>.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fcrawlers.fr%2F"

# 2. Un provider NON configuré doit répondre 400 immédiatement
curl -s -o /dev/null -w "%{http_code} %{time_total}\n" \
  "https://<ref>.supabase.co/auth/v1/authorize?provider=github"

# 3. Santé du service
#    (outil interne) supabase--cloud_status
```

Interprétation :

| Google | GitHub | Verdict |
| --- | --- | --- |
| 504 / 35 s | 400 / 0,4 s | Service auth dégradé — egress vers Google KO. Redémarrer. |
| 400 | 400 | Provider Google non activé / mal configuré. |
| 302 | 400 | Nominal. |

Le fait que GitHub réponde vite prouve que GoTrue est joignable : seul l'appel
sortant vers `accounts.google.com` bloque. Inutile de toucher au code client,
au flux PKCE ou au `redirect_to`.

## Résolution

1. Redémarrer le backend (outil `supabase--restart`).
2. Attendre le retour du service (~60-90 s : la fenêtre de redémarrage renvoie
   d'abord des 504 puis des connexions refusées `000`).
3. Re-tester `/authorize?provider=google` jusqu'à obtenir un **302**.

Mesure post-incident du 2026-09-02 : 302 en 3,9 s puis 0,6 s puis 0,12 s.

## Ce qu'il ne faut PAS faire

- Modifier `signInWithOAuth` ou le `redirect_uri` : le blocage est côté serveur auth.
- Basculer en flux implicite pour « contourner » le timeout.
- Recréer les identifiants Google : ils sont valides, ils ne sont simplement pas atteignables.

## Prévention

L'instance est en compute Tiny : la saturation DB amplifie ces timeouts.
Surveiller les requêtes longues (`pg_stat_activity`) et la latence de
`/auth/v1/health` ; un health à plusieurs secondes annonce l'incident.
