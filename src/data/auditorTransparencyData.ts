/**
 * Auditor Transparency Data — "Boîte Grise"
 * 
 * Shows partial prompts, coefficient weights, request patterns,
 * and execution flow for SEO/GEO/LLM audit functions.
 * Enough to build trust, not enough to replicate.
 */

export interface TransparencyBlock {
  /** Section title */
  title: string;
  /** Content blocks */
  sections: {
    label: string;
    type: 'prompt-excerpt' | 'coefficients' | 'request-pattern' | 'flow' | 'note';
    content: string;
  }[];
}

// ─── Functions with transparency data ───
export const AUDITOR_FUNCTIONS = new Set([
  'audit-strategique-ia',
  'expert-audit',
  'check-llm',
  'check-llm-depth',
  'calculate-llm-visibility',
  'calculate-ias',
  'check-geo',
  'check-pagespeed',
  'check-eeat',
  'process-crawl-queue',
  'fetch-serp-kpis',
  'diagnose-hallucination',
]);

export const TRANSPARENCY_DATA: Record<string, TransparencyBlock> = {
  'audit-strategique-ia': {
    title: 'Audit Stratégique IA — Moteur de scoring SEO/GEO',
    sections: [
      {
        label: 'Extrait du prompt système',
        type: 'prompt-excerpt',
        content: `Tu es un consultant SEO/GEO senior. Analyse l'URL fournie selon ces axes :
1. Performance technique (Core Web Vitals, TTFB, CLS, LCP)
2. Structure sémantique (H1-H6, schema.org, JSON-LD)
3. Signaux E-E-A-T (auteur, sources, fraîcheur)
4. Compatibilité GEO (llms.txt, citabilité, structure FAQ)
5. Maillage interne et profondeur de crawl
[... 40% du prompt masqué — logique de scoring propriétaire ...]

Retourne un objet JSON structuré avec les scores par axe (0-100).`,
      },
      {
        label: 'Pondération des scores',
        type: 'coefficients',
        content: `Score Global = Σ(axe × poids)
─────────────────────────────────────
│ Axe                    │ Poids   │
│ Performance technique  │ ~20%    │
│ Structure sémantique   │ ~20%    │
│ Signaux E-E-A-T       │ ~15%    │
│ Compatibilité GEO     │ ~15%    │
│ Maillage interne      │ ~10%    │
│ Contenu & Pertinence  │ ~10%    │
│ Signaux sociaux/backl. │ ~10%   │
─────────────────────────────────────
Note: Les poids exacts varient selon le type de page (homepage, produit, éditorial).
Un mécanisme d'adaptation dynamique ajuste ±5% selon le secteur détecté.`,
      },
      {
        label: 'Requêtes externes',
        type: 'request-pattern',
        content: `1. PageSpeed Insights API → Core Web Vitals (LCP, FID, CLS, TTFB, FCP)
2. DataForSEO → Classements SERP réels, volumes de recherche, backlinks
3. Fetch HTML → Analyse DOM (meta, schema.org, canonical, hreflang)
4. LLM (Gemini 2.5 Flash) → Narration pédagogique et scoring contextuel
5. Cache domaine → Modules stables (intro, DNA, marché, concurrence) mis en cache 24h`,
      },
      {
        label: 'Flux d\'exécution',
        type: 'flow',
        content: `URL → Normalisation → [Parallèle]
  ├─ fetchHTML (stealthFetch ou Browserless fallback)
  ├─ PageSpeed API
  └─ DataForSEO (SERP + backlinks)
→ Assemblage du contexte
→ Prompt LLM avec données réelles injectées
→ Parsing JSON structuré
→ Calcul des 3 scores de santé (0-100%)
→ Génération des recommandations priorisées
→ Watchdog global : timeout 8m30, résultats partiels sauvegardés`,
      },
    ],
  },

  'expert-audit': {
    title: 'Expert Audit — Orchestrateur multi-modules',
    sections: [
      {
        label: 'Architecture',
        type: 'flow',
        content: `L'Expert Audit orchestre 168 critères répartis en modules :
┌─ Module Technique (HTML, meta, images, liens cassés)
├─ Module Performance (Core Web Vitals via PageSpeed API)
├─ Module Sémantique (JSON-LD, OpenGraph, schema.org)
├─ Module GEO (llms.txt, citabilité, FAQ structurée)
├─ Module EEAT (signaux d'autorité, auteur, mentions)
├─ Module Concurrence (DataForSEO, backlinks, DA)
└─ Module Maillage (PageRank interne, profondeur)

Chaque module produit un score partiel (0-100).
Le score global est une moyenne pondérée.`,
      },
      {
        label: 'Extrait du prompt (narration)',
        type: 'prompt-excerpt',
        content: `Génère une analyse narrative en 3 blocs de santé :
- Bloc 1 : Santé technique (performance + structure HTML)
- Bloc 2 : Santé sémantique (schema.org + contenu + EEAT)
- Bloc 3 : Santé GEO (visibilité IA + llms.txt + citabilité)

Pour chaque bloc, attribue un score de 0 à 100% et explique 
les 3 points forts et 3 points faibles principaux.
[... instructions de formatage et ton masquées ...]`,
      },
      {
        label: 'Cache stratégique',
        type: 'note',
        content: `Les modules stables (Intro, DNA, Marché, Concurrence, EEAT, Signaux Sociaux, GMB)
sont mis en cache au niveau du domaine (clé: domain + module_name).
→ 9 audits sur 10 réutilisent le cache
→ Économie ~65% des coûts LLM
→ Bouton "Rafraîchir" force la mise à jour manuelle`,
      },
    ],
  },

  'check-llm': {
    title: 'Check LLM — Test de visibilité par modèle',
    sections: [
      {
        label: 'Extrait du prompt',
        type: 'prompt-excerpt',
        content: `Requête envoyée à chaque LLM (GPT-4, Gemini, Claude) :
"Quels sont les meilleurs [service/produit] à [localisation] ? 
Cite des entreprises spécifiques avec leurs sites web."

Variantes testées :
- Requête générique (secteur + lieu)
- Requête de recommandation directe
- Requête comparative
[... pool de 15+ variantes rotatives masqué ...]`,
      },
      {
        label: 'Scoring de visibilité',
        type: 'coefficients',
        content: `Pour chaque LLM, le score est calculé selon :
─────────────────────────────────────
│ Critère              │ Poids     │
│ Marque citée         │ 40%       │
│ URL correcte         │ 25%       │
│ Position dans liste  │ 20%       │
│ Contexte positif     │ 15%       │
─────────────────────────────────────
Score final = moyenne pondérée sur les 3 LLMs testés.
Le score est ramené sur 100 et comparé à la semaine précédente.`,
      },
      {
        label: 'Exécution',
        type: 'flow',
        content: `Domaine → Extraction marque + secteur + localisation
→ [Parallèle] Requêtes vers GPT-4, Gemini, Claude (timeout 8s chacun)
→ Promise.allSettled (résultats partiels acceptés)
→ Analyse des réponses (regex + NLP léger)
→ Scoring par modèle → Score agrégé`,
      },
    ],
  },

  'check-llm-depth': {
    title: 'Check LLM Depth — Analyse de profondeur de citation',
    sections: [
      {
        label: 'Méthodologie',
        type: 'note',
        content: `Test en profondeur : on envoie des prompts itératifs (jusqu'à 5 tours)
pour mesurer à quelle "profondeur" de conversation un LLM cite la marque.

Itération 1 : requête générique large
Itération 2 : requête plus spécifique au secteur
Itération 3 : requête avec contrainte géographique
Itération 4 : demande de recommandation directe
Itération 5 : question de comparaison

Le score de profondeur = itération à laquelle la marque apparaît (1 = excellent, 5 = faible).
"Non trouvé" après 5 tours = score 0.`,
      },
    ],
  },

  'calculate-llm-visibility': {
    title: 'Calculate LLM Visibility — Score de visibilité IA',
    sections: [
      {
        label: 'Formule',
        type: 'coefficients',
        content: `Visibilité LLM (%) = (Σ scores_par_modèle × poids_modèle) / total_poids

Poids des modèles (parts de marché estimées) :
─────────────────────────────────────
│ Modèle    │ Poids marché │
│ ChatGPT   │ ~45%         │
│ Gemini    │ ~30%         │
│ Claude    │ ~15%         │
│ Perplexity│ ~10%         │
─────────────────────────────────────
Les parts de marché sont mises à jour mensuellement
via la table market_trends (région : France).`,
      },
      {
        label: 'Historisation',
        type: 'note',
        content: `Le score est enregistré chaque semaine dans llm_visibility_scores.
Le delta semaine/semaine est calculé et affiché en tendance.
Un score < 20% déclenche une alerte "Faible visibilité IA".`,
      },
    ],
  },

  'calculate-ias': {
    title: 'Calculate IAS — Indice d\'Alignement Stratégique',
    sections: [
      {
        label: 'Définition',
        type: 'note',
        content: `L'IAS (Indice d'Alignement Stratégique) mesure l'équilibre entre 
trafic de marque et trafic générique. Un site trop dépendant de sa marque
est vulnérable aux changements algorithmiques.`,
      },
      {
        label: 'Formule',
        type: 'coefficients',
        content: `IAS = f(ratio_réel, ratio_cible, pénétration_marque)

ratio_réel = clics_génériques / clics_totaux
ratio_cible = dépend du type d'activité :
─────────────────────────────────────
│ Type          │ Ratio cible │
│ E-commerce    │ 60-70%      │
│ SaaS/Tech     │ 50-60%      │
│ Éditorial     │ 70-80%      │
│ Service local │ 40-50%      │
─────────────────────────────────────

risk_score = |ratio_réel - ratio_cible| × facteur_sévérité
IAS = 100 - risk_score (borné 0-100)`,
      },
      {
        label: 'Source de données',
        type: 'request-pattern',
        content: `GSC (Google Search Console) via OAuth :
→ Requêtes avec filtre "marque" (détection automatique via brand_name)
→ Requêtes génériques = total - marque
→ Agrégation sur 28 jours glissants`,
      },
    ],
  },

  'check-geo': {
    title: 'Check GEO — Score d\'optimisation pour l\'IA générative',
    sections: [
      {
        label: 'Extrait du prompt',
        type: 'prompt-excerpt',
        content: `Évalue la compatibilité GEO (Generative Engine Optimization) de cette page :

Critères principaux :
1. Présence et qualité du fichier llms.txt
2. Structure FAQ avec balisage schema.org/FAQPage  
3. Citabilité : phrases courtes, factuelles, sourcées
4. Données structurées exploitables par les LLMs
5. Fraîcheur du contenu (date de mise à jour)
[... grille de scoring détaillée masquée ...]`,
      },
      {
        label: 'Scoring GEO',
        type: 'coefficients',
        content: `Score GEO = Σ(critère × poids)
─────────────────────────────────────
│ Critère              │ Poids     │
│ llms.txt             │ ~20%      │
│ FAQ structurée       │ ~20%      │
│ Citabilité           │ ~20%      │
│ Données structurées  │ ~15%      │
│ Fraîcheur contenu    │ ~10%      │
│ Longueur contenu     │ ~10%      │
│ Sources/références   │ ~5%       │
─────────────────────────────────────`,
      },
    ],
  },

  'check-pagespeed': {
    title: 'Check PageSpeed — Core Web Vitals',
    sections: [
      {
        label: 'Source de données',
        type: 'request-pattern',
        content: `API Google PageSpeed Insights v5
→ Stratégie : mobile (par défaut) + desktop
→ Métriques extraites : LCP, FID, CLS, TTFB, FCP, SI, TBT
→ Rate limiting : max 30 requêtes concurrentes, protection IP`,
      },
      {
        label: 'Scoring',
        type: 'coefficients',
        content: `Le score performance reprend le scoring Lighthouse :
─────────────────────────────────────
│ Métrique │ Bon      │ Moyen     │ Mauvais   │
│ LCP      │ < 2.5s   │ 2.5-4s   │ > 4s      │
│ FID      │ < 100ms  │ 100-300ms│ > 300ms   │
│ CLS      │ < 0.1    │ 0.1-0.25 │ > 0.25    │
│ TTFB     │ < 800ms  │ 800-1.8s │ > 1.8s    │
─────────────────────────────────────
Score global = weighted average selon les seuils Google.`,
      },
    ],
  },

  'process-crawl-queue': {
    title: 'Process Crawl Queue — Moteur de crawl',
    sections: [
      {
        label: 'Architecture de crawl',
        type: 'flow',
        content: `Queue de pages à traiter → Worker de crawl
1. StealthFetch (gratuit, prioritaire) avec rotation UA
2. Si échec ou contenu < 500 chars → Fallback Firecrawl (payant)
3. Extraction DOM : titre, meta, H1-H6, images, liens, schema.org
4. Calcul du score SEO par page (0-100)
5. Détection des problèmes (liens cassés, images sans alt, etc.)
6. Sauvegarde en base (crawl_pages)

Limite : 20 pages max par crawl.
Concurrence max : configurable par job.`,
      },
      {
        label: 'StealthFetch vs Firecrawl',
        type: 'note',
        content: `StealthFetch : module interne gratuit avec rotation de 17+ User-Agents,
randomisation des headers (Sec-CH-UA, Referer, Accept-Language),
jitter aléatoire et backoff exponentiel. Gère 80-90% des sites.

Firecrawl : API payante utilisée uniquement en fallback pour les sites
avec protection Cloudflare, WAF strict, ou rendu JavaScript obligatoire.`,
      },
    ],
  },

  'fetch-serp-kpis': {
    title: 'Fetch SERP KPIs — Données de classement réel',
    sections: [
      {
        label: 'Source de données',
        type: 'request-pattern',
        content: `DataForSEO API :
→ SERP reguliers : positions organiques pour les mots-clés cibles
→ Volumes de recherche : estimations mensuelles par mot-clé
→ Backlinks : nombre de domaines référents, autorité du domaine
→ Géolocalisation : résultats localisés (France par défaut)`,
      },
      {
        label: 'Algorithme de mots-clés',
        type: 'flow',
        content: `Phase 1 — Seeding : extraction des mots-clés du contenu HTML
Phase 2 — Expansion : suggestions DataForSEO + variantes sémantiques
Phase 3 — Pépites : mots-clés longue traîne à fort potentiel
         (volume > seuil ET position 11-30 = opportunité)

Les mots-clés sont classés par ROI estimé :
ROI = volume × CTR_estimé × (1 / difficulté)`,
      },
    ],
  },

  'diagnose-hallucination': {
    title: 'Diagnose Hallucination — Détecteur de biais LLM',
    sections: [
      {
        label: 'Méthodologie',
        type: 'note',
        content: `Compare les données factuelles (DataForSEO, GSC) avec les affirmations 
des LLMs sur un domaine. Détecte :
- Confusions de marque (marque A attribuée à marque B)
- URLs incorrectes ou inexistantes
- Classements inventés
- Métriques hallucinées (DA, trafic fictif)

Les écarts sont quantifiés et classés par gravité.`,
      },
      {
        label: 'Extrait du prompt',
        type: 'prompt-excerpt',
        content: `Compare ces données réelles avec les affirmations du LLM :
- Données réelles : [positions SERP, backlinks, trafic GSC]
- Réponse LLM : [texte brut de la réponse]

Identifie chaque divergence factuelle et classe-la :
- CRITICAL : information complètement fausse
- WARNING : information déformée ou imprécise  
- INFO : information non vérifiable
[... instructions de formatage masquées ...]`,
      },
    ],
  },
};

/** Check if a function has auditor transparency data */
export function hasTransparencyData(fnName: string): boolean {
  return AUDITOR_FUNCTIONS.has(fnName);
}
