---
name: Parmenion Image Originality
description: Rotation déterministe de style + angle visuel par persona pour les images Parménion (anti-monotonie visuelle).
type: feature
---

## Originalité visuelle Parménion (2026-06-28)

### Problème
`generateAndAttachImage` (autopilot-engine) utilisait un prompt figé `cinematic` + `"Evocative visual illustration for a blog article about: {title}"`. Sur un site mono-thématique (ex iktracker.fr, 60+ articles indemnités kilométriques), résultat = images visuellement très répétitives (mêmes voitures, mêmes routes, mêmes palettes).

### Solution
Nouveau module `_shared/parmenion/imageOriginality.ts` → `buildOriginalImageBrief({ supabase, trackedSiteId, slug, title, excerpt })`.

1. **Rotation de style déterministe** (hash FNV-1a du slug) parmi 5 styles supportés par `_shared/imageGeneration.ts` : `cinematic, flat, isometric, watercolor, bw_photo`.
2. **Angle visuel métonymique** tiré de la dernière persona servie pour le site (`persona_rotation_log.last_served_at DESC LIMIT 1`). 11 personas câblées avec 3 angles concrets chacune (objets/lieux/scènes, jamais de visage identifiable). Fallback `GENERIC_ANGLES` si aucune persona servie.
3. **Pas de visage identifiable** ajouté au prompt (RGPD-safe + cohérent avec NO_TEXT_GUARD).

Zéro coût LLM additionnel : réutilise la donnée déjà calculée par persona-decomposition-engine. Cycle next : `style + angle` rotent ensemble, garantissant qu'aucun cycle ne produit deux fois la même combinaison.

### Intégration
- `autopilot-engine/index.ts` ligne ~775 : `generateAndAttachImage` reçoit `config.tracked_site_id` et appelle `buildOriginalImageBrief` avant `generate-image`.
- Log enrichi : `style=… persona=… angle="…"` pour traçabilité.

### Ce qui n'est PAS implémenté
- Pas de hash perceptuel (pHash) ni table `parmenion_image_fingerprints` — la rotation déterministe garantit la diversité statistique mais pas l'unicité visuelle stricte. Si nécessaire plus tard : Hamming<10 sur 64-bit dHash, bloquer + regen.
