# Memory: features/support/felix-navigation-action-fr
Updated: just now

## Redirection Félix → Pages d'action

Félix détecte les intentions de crawl ou d'audit dans les messages utilisateur et redirige automatiquement vers la page appropriée avec l'URL pré-remplie.

### Détection d'intention
- **Crawl** : patterns "lance un crawl", "crawle mon site", "scanne toutes les pages", etc.
- **Audit** : patterns "lance un audit", "audit expert", "analyse SEO", etc.

### Comportement par type d'action
- **Crawl** (action simple) : Redirection vers `/app/site-crawl?url=X&from=felix&autostart=true` → le crawl se lance automatiquement
- **Audit** (action coûteuse) : Redirection vers `/audit-expert?url=X&from=felix` → l'URL est pré-remplie et l'audit se lance automatiquement

### Flux technique
1. `sav-agent` détecte l'intention + extrait l'URL (message ou site tracké)
2. Retourne `navigation_action: { action, url, autostart }` dans la réponse
3. `ChatWindow.tsx` intercepte `navigation_action` et appelle `navigate()` après 1.5s
4. La page cible lit les query params et déclenche l'action

### Extraction d'URL
- Priorité : URL dans le message > domaine du premier site tracké de l'utilisateur
- Normalisation automatique (ajout `https://` si absent)
