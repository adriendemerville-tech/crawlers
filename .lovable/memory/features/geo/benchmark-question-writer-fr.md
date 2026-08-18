---
name: Rédaction LLM des questions de benchmark GEO
description: Les 9 questions de benchmark sont reformulées par un seul appel LLM à partir de la carte d'identité, les axes/besoins/intentions restant déterministes
type: feature
---
`supabase/functions/_shared/benchmarkQuestionWriter.ts` — `naturalizeBenchmarkQuestions()`, appelé par `calculate-llm-visibility` juste après `buildLlmBenchmarks`.

Répartition des rôles, à ne pas inverser :
- **Déterministe (0 token)** : `questionTopics.ts` choisit les 3 besoins et leur axe de marché (couvert / mieux classé / non capté), `llmBenchmarks.ts` fixe les 3 intentions par bloc (découverte / comparaison / contexte, local obligatoire si zone de chalandise) et produit une formulation de repli.
- **LLM (1 seul appel pour les 9 questions, feature `benchmark_questions` du routeur, modèle rapide, JSON)** : uniquement la formulation, à la première personne, dans la peau d'un client potentiel, avec la carte d'identité en contexte et l'usage du benchmark expliqué au modèle.

Garde-fous de sortie, appliqués question par question (toute question refusée garde sa version déterministe) : 20-200 caractères, une seule phrase interrogative, point d'interrogation final, aucune mention de la marque / du site / d'URL (`scrubBrandFromText`), aucun marqueur de fuite de prompt ou de champ brut, unicité globale des textes posés. Échec réseau, JSON invalide ou nombre de blocs différent → repli intégral sur le déterministe.

L'empreinte des questions (`prompts_fingerprint`) invalide le cache `domain_data_cache` quand les formulations changent : un audit relancé repose les nouvelles questions.
