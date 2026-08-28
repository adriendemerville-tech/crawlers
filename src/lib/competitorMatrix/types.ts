// Types partagés de l'outil gratuit « Matrice Concurrence » (client + serveur).
// Règle produit : aucune donnée n'est inventée. Une case non mesurée porte
// l'état `not_measured`, jamais `absent`.

export type CompetitorType =
  | 'metier'      // même produit/service, même marché
  | 'visibilite'  // rank Google/IA sur nos mots-clés, offre différente
  | 'silencieux'  // même offre, aucune visibilité
  | 'substitut'   // besoin identique, moyen différent (hors matrice)
  | 'goliath';    // plateforme dominante (hors matrice)

export const COMPETITOR_TYPE_LABEL: Record<CompetitorType, string> = {
  metier: 'Concurrent métier',
  visibilite: 'Concurrent de visibilité',
  silencieux: 'Concurrent silencieux',
  substitut: 'Substitut fonctionnel',
  goliath: 'Goliath',
};

export interface Competitor {
  domain: string;
  name: string;
  type: CompetitorType;
  reason: string;
  source: 'dataforseo' | 'llm' | 'user';
}

export interface MarketKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  value: number;
  origin: 'target' | 'gap' | 'ia';
}

export type CoverageState = 'covered' | 'weak' | 'absent' | 'not_applicable' | 'not_measured';

export const COVERAGE_LABEL: Record<CoverageState, string> = {
  covered: 'Couvert',
  weak: 'Faible',
  absent: 'Absent',
  not_applicable: 'Non applicable',
  not_measured: 'Non mesuré',
};

export interface MatrixCell {
  keyword: string;
  position: number | null;
  aiCitationRate: number | null; // 0..1 sur 3 itérations × 4 moteurs ; null = non mesuré
  state: CoverageState;
}

export interface MatrixRow {
  domain: string;
  name: string;
  type: CompetitorType | 'target';
  cells: MatrixCell[];
  inAiOverview: boolean;
}

export interface AiOverviewCell {
  keyword: string;
  triggered: boolean | null; // null = relevé SERP indisponible
  domains: string[];
}

export interface MatrixSummary {
  covered: string[];
  weak: string[];
  missing: string[];
  noMansLand: string[];
  lostAgainst: { domain: string; count: number }[];
  aiOverviewLeaders: { domain: string; count: number }[];
  measuredKeywords: number;
  aiMeasuredKeywords: number;
}

export interface MatrixResult {
  rows: MatrixRow[];
  aiOverviewRow: AiOverviewCell[];
  outOfScope: Competitor[];
  summary: MatrixSummary;
}

export interface Identity {
  domain: string;
  name: string;
  activity: string;
  locality: string | null;
}

export interface SerpReadingJson {
  keyword: string;
  positions: Record<string, number>;
  aiOverview: AiOverviewCell;
}

export interface AiReadingJson {
  keyword: string;
  rates: Record<string, number>;
  // Accumulation par moteur : un appel serveur = un moteur × 3 itérations,
  // pour rester sous la limite de temps du worker.
  hits?: Record<string, number>;
  observations?: number;
  modelsDone?: string[];
}

export type MatrixStep = 'pending' | 'identity' | 'competitors' | 'keywords' | 'serp' | 'ai' | 'done';

export const STEP_LABEL: Record<MatrixStep, string> = {
  pending: 'En file',
  identity: 'Identité de l’entreprise',
  competitors: 'Détection des concurrents',
  keywords: 'Mots-clés du marché',
  serp: 'Relevés Google et AI Overviews',
  ai: 'Citations Gemini, ChatGPT, Claude et Perplexity',
  done: 'Terminé',
};

export interface MatrixJobState {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  step: MatrixStep;
  progress: number;
  domain: string;
  targetUrl: string;
  identity: Identity | null;
  competitors: Competitor[];
  keywords: MarketKeyword[];
  matrix: MatrixResult | null;
  error: string | null;
  shareToken: string;
}

export const MATRIX_KEYWORDS = 20;
export const AI_MEASURED_KEYWORDS = 10;
export const AI_ITERATIONS = 3;
export const LOCATION_FR = 2250;
