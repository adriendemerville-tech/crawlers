---
name: Dictadevi Bridge
description: Bridge dictadevi-actions, garde éditoriale, et conversion Markdown→HTML automatique sur create-post / update-post
type: feature
---

## Bridge dictadevi-actions

Pont REST entre Crawlers (Parménion) et l'API custom Dictadevi (`https://dictadevi.io/api/v1`, auth `Bearer dk_...`).

### Garde Markdown→HTML (mai 2026)
Parménion et le pipeline éditorial peuvent produire spontanément du Markdown (`#`, `**`, listes `-`). Dictadevi attend du HTML rendu — sinon le contenu s'affiche brut.

`ensureHtmlContent()` est appelé sur **tout `create-post` / `update-post`** avant push :
- Champs scannés : `content`, `body`, `excerpt`
- Détection : signaux Markdown (`^# `, `**…**`, `[text](url)`, etc.) ET absence de balises HTML structurelles (`<p>`, `<h1-6>`, `<ul>`, …)
- Conversion : `marked@12.0.2` (GFM activé, pas de `breaks`)
- Idempotent : si déjà HTML, aucune transformation
- Logué : `[dictadevi-actions] create-post:slug: champ "body" converti Markdown→HTML (X → Y chars)`

### Garde éditoriale
- Refus si auteur ∈ {parménion, parmenion, crawlers autopilot}
- Refus si `published_at` > 6 mois

### Actions non supportées par Dictadevi v1 (→ 501)
push-code-*, get-injection-*, robots, redirects, push-event, *-page (Dictadevi n'expose que `/posts` en écriture).
