---
name: Diagnostic timeout Google OAuth
description: upstream request timeout sur /auth/v1/authorize?provider=google = service auth dégradé, pas un bug applicatif
type: feature
---

Symptôme : « Connexion avec Google » tourne indéfiniment, `/auth/v1/authorize?provider=google` renvoie 504 après ~35 s avec `upstream request timeout`.

Cause : GoTrue n'atteint plus `https://accounts.google.com/.well-known/openid-configuration` (`context deadline exceeded`). Service auth saturé/dégradé.

Test discriminant : un provider NON configuré (`?provider=github`) répond 400 en < 0,5 s → GoTrue est joignable, seul l'egress Google bloque.

Résolution : redémarrer le backend, attendre 60-90 s (504 puis `000`), re-tester jusqu'au 302.

Ne jamais « corriger » en modifiant `signInWithOAuth`, le `redirect_uri`, le flux PKCE ou les identifiants Google.

Runbook complet : `knowledge/tech/security/auth-google-oauth-runbook-fr.md`
