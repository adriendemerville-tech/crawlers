# Memory: tech/audit/eeat-scoring-v3-fr
Updated: 2026-04-13

## Scoring E-E-A-T v3 — Évolutions

### Nouvelles pénalités algorithmiques (check-eeat)

**Experience :**
- Témoignages non vérifiables (pas de noms propres, entreprises, chiffres) → -10 pts
- Page À propos sans incarnation humaine (pas de fondateur/équipe nommés) → -8 pts
- Aucune page À propos → -12 pts

**Authoritativeness (business digitaux uniquement) :**
- Critère : entity_type/business_type/commercial_model contient saas|media|agency|ecommerce|marketplace|platform|app|digital
- 0 backlink éditorial + domaine ≥2 ans → -15 pts
- 0 backlink éditorial + domaine <2 ans → -5 pts (tolérance lancement)
- 1-3 backlinks éditoriaux + domaine ≥2 ans → -5 pts
- 1-3 backlinks éditoriaux + domaine <2 ans → -3 pts
- 4+ backlinks éditoriaux → pas de malus
- Bonus: GA4 referral sessions > 50 → +5 pts
- Non applicable aux artisans, commerces locaux, professions libérales

**Qualification backlinks éditoriaux :** Exclusion automatique des annuaires, directories, listings, Trustpilot, Capterra, G2, bookmarks, aggregateurs.

### Nouveaux signaux dans aggregateSignals
- `testimonialsVerifiable` : détection de noms propres, entreprises (SAS/SARL/etc.), chiffres spécifiques, citations attribuées
- `aboutPageHasIncarnation` : fondateur/équipe nommés + mots-clés bio (fondateur, CEO, directeur, parcours, photo)

### Méthode de scoring
- `weighted_algorithmic_v3` (anciennement v2)
- Pondération inchangée : E×1.5, Ex×2.5, A×2.5, T×4

### Évolutions agent-seo
- Cas clients qualifiés : +15 si vérifiable, +5 si générique (au lieu de +15 systématique)
- Pénalité ancres CTA génériques : -10 si >60% des ancres internes sont "en savoir plus", "découvrir", etc.
- Bonus contenu daté < 12 mois (+8), signal "content decay" si > 24 mois

### Évolutions prompts GEO (audit-strategique-ia, strategicPrompts, strategicSplitPrompts)
- **Paradoxe vendeur** : instruction de détecter si le site vend un service X sans exhiber les signaux de X
- **Malus autorité proportionné** : barème dégressif basé sur backlinks éditoriaux × âge domaine
- **Qualification proof_sources** : verified / inferred / absent (anti-hallucination)
- **Cohérence tonale** : ton générique/IA + prétention d'expertise → expertise_sentiment max 2

### Fichiers modifiés
- `supabase/functions/check-eeat/index.ts`
- `supabase/functions/agent-seo/index.ts`
- `supabase/functions/audit-strategique-ia/index.ts`
- `supabase/functions/_shared/strategicPrompts.ts`
- `supabase/functions/_shared/strategicSplitPrompts.ts`
