# Automatisation LinkedIn hebdomadaire — v2

Mise à jour du plan initial pour intégrer :
- **Texte** : Mistral via **OpenRouter** (clé `OPENROUTER_API_KEY` déjà utilisée par `_shared/openRouterAI.ts`).
- **Médias** : **WaveSpeed.ai** via le proxy admin déjà déployé (`wavespeed-proxy`, clé `WAVESPEED_API_KEY` OK).

Le reste de l'architecture (catalogue de features, rotation, UI admin de validation, cron lundi 07:00, publisher LinkedIn) reste identique au plan initial.

---

## Ce qui change

### 1. Rédaction du texte — Mistral / OpenRouter
- Modèle par défaut : `mistralai/mistral-large-latest` (rédactionnel FR de qualité, coût raisonnable).
- Appel via le wrapper existant `supabase/functions/_shared/openRouterAI.ts` (`callOpenRouterJson`) → réponse JSON strict `{ text, hashtags[] }`.
- Prompt système/utilisateur inchangé (ton Crawlers : direct, expert, sans emoji, sans bleu IA, 1200-1600 caractères).
- On remplace donc l'appel `ai.gateway.lovable.dev` actuellement présent dans `linkedin-post-generator/index.ts`.

### 2. Génération des médias — WaveSpeed
Deux modes en alternance selon la parité du numéro de semaine ISO :

**Image (carrousel 6 slides)**
- Modèle : `bytedance/seedream-4` (ou équivalent T2I catalogue WaveSpeed) — 1200×1200, style plat/éditorial, palette Crawlers (violet #7C3AED, or #F59E0B, noir, blanc).
- 6 appels séquentiels avec prompts dérivés du texte du post : cover, 3 slides pédagogiques (angle marketing feature), 1 slide preuve/chiffre, 1 slide CTA.
- Contrainte NO_TEXT_GUARD respectée (aucun texte dans l'image, le texte reste dans la légende LinkedIn).

**Vidéo (screencast marketing 5-10s)**
- Modèle : `bytedance/seedance-v1-pro-t2v-480p` (ou 720p si dispo dans la formule) — 5s, 16:9 ou 1:1.
- Prompt dérivé automatiquement de la feature (`marketing_angle`).

**Orchestration WaveSpeed (async)**
- `wavespeed-proxy action=submit` → renvoie `prediction_id`.
- Polling toutes les 3s côté edge function `linkedin-media-generator` jusqu'à `status=succeeded` (max 120s).
- Téléchargement des URLs de sortie → upload sur bucket Storage `linkedin-media` → URLs signées enregistrées dans `linkedin_scheduled_posts.media_urls[]`.

### 3. Nouvelle edge function `linkedin-media-generator`
Remplace `linkedin-carousel-renderer` + `linkedin-video-renderer` du plan initial (plus besoin de Playwright/ffmpeg côté edge).

Entrée : `{ post_id }` → lit le draft, appelle WaveSpeed selon `media_type`, met à jour `media_urls[]` et `media_generation_status`.

### 4. UI admin (`/admin/linkedin`)
Inchangée sur le principe, avec en plus :
- Sélecteur du modèle WaveSpeed (image / vidéo) avec valeur par défaut, pour permettre à Adrien de tester d'autres modèles depuis le playground existant.
- Bouton **Régénérer médias** → relance `linkedin-media-generator`.

---

## Livrables mis à jour

```text
supabase/functions/
  ├── linkedin-post-generator/      (MAJ : appelle openRouterAI + Mistral)
  ├── linkedin-media-generator/     (NOUVEAU : appelle wavespeed-proxy submit + poll)
  └── linkedin-publisher/           (inchangé — upload + UGC via gateway LinkedIn)

supabase/migrations/
  └── xxx_linkedin_media_fields.sql (ajoute media_provider, wavespeed_prediction_ids[])

src/pages/admin/
  └── LinkedInAutomation.tsx        (UI review/publish, boutons régénérer texte/média)
```

## Phasage proposé
1. **Sprint 1 (rapide)** — MAJ `linkedin-post-generator` pour utiliser Mistral via `openRouterAI`, + UI admin de validation des drafts texte seul.
2. **Sprint 2** — `linkedin-media-generator` (WaveSpeed image → carrousel 6 slides), preview dans l'UI.
3. **Sprint 3** — Mode vidéo WaveSpeed + publisher LinkedIn + cron lundi 07:00.

## Phasage proposé
1. **Sprint 1 (rapide)** — MAJ `linkedin-post-generator` pour utiliser Mistral via `openRouterAI`, + UI admin de validation des drafts texte seul.
2. **Sprint 2** — `linkedin-media-generator` (WaveSpeed image → carrousel 6 slides), preview dans l'UI.
3. **Sprint 3** — Mode vidéo WaveSpeed + publisher LinkedIn + cron.

## Planning hebdo (fixé)
- **Jeudi 07:00 (Europe/Paris)** : `pg_cron` déclenche `linkedin-post-generator` → nouveau draft `pending_review` + notif admin.
- **Fenêtre de review** : jeudi → mardi soir (6 jours pour relire, éditer, régénérer texte/média).
- **Mercredi 08:00 (Europe/Paris)** : `pg_cron` déclenche `linkedin-publisher` sur le draft `approved` le plus récent. Si aucun draft approuvé → skip + alerte, aucun post publié (safety).
- Anti-spam : garde DB `max 1 post publié / 7 jours` inchangée.
