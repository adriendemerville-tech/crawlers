# Automatisation LinkedIn hebdomadaire — Crawlers

## Objectif
Chaque lundi matin, générer automatiquement un post LinkedIn valorisant une feature Crawlers (rotation), avec en alternance un **carrousel 6 images** et une **vidéo screencast MP4**. Le post est préparé en brouillon dans une UI admin ; publication en un clic après relecture/édition.

## Architecture

### 1. Base de données
- `linkedin_features_catalog` — catalogue des features Crawlers à valoriser (title, slug, description, url_screenshot_hint, angle_marketing, active). Seed initial avec ~15 features (Autopilot Parménion, Cocoon 3D, Strategic Audit v5, GEO Bot Attribution, Content Architect, SERP Benchmark, Copilot Market Diagnosis, Drop Detector, Breathing Spiral, SEA→SEO Bridge, etc.).
- `linkedin_scheduled_posts` — draft/pending_review/approved/published/failed, media_type ('carousel'|'video'), scheduled_for, feature_id, generated_text, media_urls[], linkedin_post_urn, error.
- `linkedin_media_assets` — assets uploadés (bucket Storage `linkedin-media`), lien vers post.

### 2. Génération du contenu (edge function `linkedin-post-generator`)
- Sélectionne la prochaine feature (rotation round-robin sur `last_used_at`).
- Alterne carrousel/vidéo selon la parité du numéro de semaine.
- Rédige le post via Lovable AI (`openai/gpt-5.5`) : hook, corps, CTA soft vers crawlers.fr, 3-5 hashtags SEO/GEO.
- Cache Markdown pour éviter regénération.

### 3. Génération des médias
**Carrousel (6 slides PNG 1200×1200) :**
- Rendu HTML/CSS aux couleurs Crawlers (violet #7C3AED, jaune d'or #F59E0B, noir, blanc — pas de bleu IA).
- Screenshot Playwright headless dans l'edge function (déjà utilisé pour Browserless).
- Slides : 1 cover, 2-4 slides pédagogiques sur la feature, 1 slide résultat/preuve, 1 slide CTA.

**Vidéo screencast (MP4 720p, 20-30s) :**
- Playwright enregistre une navigation scriptée sur la feature ciblée (ex: `/console`, `/mes-sites`, `/autopilot`) en mode démo auth-injecté.
- ffmpeg (déjà présent) encode en MP4 H.264 muet + overlay logo/légendes.
- Upload sur Storage → URL signée.

### 4. Publication LinkedIn (gateway `w_member_social`)
- Register upload → PUT binaire → `POST /v2/ugcPosts` (multi-image ou video).
- Enregistre `linkedin_post_urn` + timestamp.

### 5. UI admin (`/admin/linkedin`)
- Liste des posts en `pending_review` avec preview média + texte éditable.
- Boutons : **Régénérer texte**, **Régénérer médias**, **Approuver & publier maintenant**, **Programmer**, **Rejeter**.
- Historique des posts publiés + lien vers LinkedIn.
- Toggle actif/pause du cron.
- Respecte la charte : boutons bordure + texte (pas de fond coloré), pas d'emoji, pas de bleu IA.

### 6. Cron (`pg_cron`)
- Chaque lundi 07:00 UTC : appelle `linkedin-post-generator` → crée un draft en `pending_review`.
- Notif email/in-app à Adrien pour valider avant midi.
- Si non validé après 48h : status `expired`, on ne publie pas (safety).

## Sécurité & garde-fous
- RLS strict : seul l'admin (has_role `admin`) accède aux tables.
- Anti-spam : max 1 post publié / 7 jours (contrainte DB).
- Validation Zod côté edge function.
- Fallback : si génération vidéo échoue (Playwright timeout), bascule automatiquement en carrousel.
- Budget LLM : cap à ~2000 tokens par post (rédaction + reformulations).

## Livrables techniques
```text
supabase/migrations/
  ├── xxx_linkedin_automation.sql   (3 tables + RLS + cron)
supabase/functions/
  ├── linkedin-post-generator/      (texte + orchestration médias)
  ├── linkedin-carousel-renderer/   (Playwright → 6 PNG)
  ├── linkedin-video-renderer/      (Playwright + ffmpeg → MP4)
  └── linkedin-publisher/           (upload + UGC post via gateway)
src/pages/admin/
  └── LinkedInAutomation.tsx        (UI review/publish)
src/components/admin/linkedin/
  ├── PostDraftCard.tsx
  ├── MediaPreview.tsx
  └── FeatureCatalogEditor.tsx
```

## Limites connues (déjà validées avec toi)
- Pas de "vrai" carrousel PDF LinkedIn (endpoint `documents` fermé aux apps standard) → carrousel multi-images natif à la place, tout aussi performant.
- Vidéo ≤ 200 Mo / 10 min (largement suffisant).
- Le token LinkedIn du connecteur expire ; le gateway rafraîchit automatiquement.

## Phasage suggéré
1. **Sprint 1** — Schéma DB + catalogue features + générateur texte + UI admin (draft manuel, sans média).
2. **Sprint 2** — Renderer carrousel + publisher LinkedIn (test bout-en-bout avec 1 post manuel).
3. **Sprint 3** — Renderer vidéo screencast + cron hebdo + alternance.

Confirme le phasage (ou attaque direct Sprint 1+2 en une passe) et je démarre.
