/**
 * Page Intent Classifier — Heuristic, deterministic, no LLM.
 *
 * Returns one of: know | do | buy | navigate | unknown
 * Confidence is a weighted score 0..1. If < 0.7 → returned as "unknown".
 *
 * Signals:
 *  - URL path patterns (/blog/, /guide/, /produit/, /panier/, /contact/, /a-propos/, …)
 *  - Title + H1 lexicon (FR/EN): comment, pourquoi, qu'est-ce, guide, definition (Know);
 *    télécharger, acheter, panier, prix, devis, commander (Do/Buy);
 *    contact, mentions, équipe, à propos (Navigate)
 *  - Schema.org types (Article/HowTo/FAQ → Know, Product/Offer → Buy, ContactPage → Navigate)
 *  - Meta description verbs
 */

export type PageIntent = 'know' | 'do' | 'buy' | 'navigate' | 'unknown';

export interface IntentSignal {
  intent: PageIntent;
  confidence: number; // 0..1
  rawIntent: Exclude<PageIntent, 'unknown'>; // best guess even when unknown
  scores: Record<Exclude<PageIntent, 'unknown'>, number>;
}

interface PageInput {
  url: string;
  path?: string | null;
  title?: string | null;
  h1?: string | null;
  meta_description?: string | null;
  schema_org_types?: string[] | null;
  word_count?: number | null;
  internal_links?: number | null;
  external_links?: number | null;
}

const CONFIDENCE_THRESHOLD = 0.7;

// ── URL path patterns ──
const URL_PATTERNS: Array<[RegExp, Exclude<PageIntent, 'unknown'>, number]> = [
  // Know
  [/\/(blog|guide|guides|article|articles|actualite|actualites|news|tutorial|tutoriel|comment|qu-est-ce|definition|lexique|glossaire|wiki|aide|help|faq|ressources?|resources?)\//i, 'know', 0.85],
  [/\/(category|categorie|tag|tags|theme|themes)\//i, 'know', 0.55],
  // Do (action / outil / téléchargement / inscription / formulaire)
  [/\/(outil|tool|tools|simulateur|calculateur|calculator|generateur|generator|telecharger|download|inscription|signup|signin|register|login|connexion|reservation|booking|rdv|rendez-vous|formulaire|form|demande|estimation|devis-en-ligne)\//i, 'do', 0.85],
  // Buy (transactionnel)
  [/\/(produit|produits|product|products|boutique|shop|store|panier|cart|checkout|paiement|payment|tarif|tarifs|prix|pricing|achat|acheter|buy|order|commander|abonnement|subscription|offre|offres|forfait|forfaits|plan|plans)\//i, 'buy', 0.9],
  [/\/(devis|quote|estimation)\//i, 'buy', 0.7],
  // Navigate
  [/\/(contact|a-propos|about|qui-sommes-nous|equipe|team|mentions|legal|cgv|cgu|privacy|confidentialite|sitemap|plan-du-site|404|search|recherche)\//i, 'navigate', 0.9],
  [/^\/?$/i, 'navigate', 0.5], // home is navigation hub
];

// ── Lexicon (title/h1/meta) ──
const LEX_KNOW = [
  'comment', 'pourquoi', 'qu’est-ce', "qu'est-ce", 'définition', 'definition', 'guide', 'tutoriel', 'tutorial',
  'expliquer', 'comprendre', 'apprendre', 'savoir', 'tout savoir', 'introduction',
  'how to', 'what is', 'why', 'learn', 'understand', 'explain', 'meaning',
];
const LEX_DO = [
  'télécharger', 'telecharger', 'download', 'inscrire', 'inscription', 'créer un compte', 'creer un compte',
  'simuler', 'calculer', 'générer', 'generer', 'utiliser', 'essayer', 'tester', 'demander', 'réserver', 'reserver',
  'try', 'use', 'create', 'register', 'sign up', 'book', 'request',
];
const LEX_BUY = [
  'acheter', 'achat', 'commander', 'commande', 'panier', 'prix', 'tarif', 'tarifs', 'devis', 'offre',
  'abonnement', 'forfait', 'promo', 'promotion', 'soldes', 'remise', 'réduction', 'reduction',
  'buy', 'purchase', 'order', 'price', 'pricing', 'quote', 'subscribe', 'subscription', 'plan', 'deal',
];
const LEX_NAVIGATE = [
  'contact', 'contactez', 'à propos', 'a propos', 'mentions légales', 'mentions legales',
  'qui sommes-nous', 'équipe', 'equipe', 'plan du site', 'sitemap',
  'about', 'team', 'legal', 'privacy', 'terms',
];

// ── Schema.org → intent hints ──
const SCHEMA_HINTS: Record<string, [Exclude<PageIntent, 'unknown'>, number]> = {
  Article: ['know', 0.6],
  NewsArticle: ['know', 0.7],
  BlogPosting: ['know', 0.75],
  HowTo: ['know', 0.7],
  FAQPage: ['know', 0.7],
  QAPage: ['know', 0.6],
  Course: ['know', 0.6],
  Product: ['buy', 0.85],
  Offer: ['buy', 0.85],
  AggregateOffer: ['buy', 0.85],
  Service: ['buy', 0.55],
  ContactPage: ['navigate', 0.9],
  AboutPage: ['navigate', 0.85],
  WebPage: ['navigate', 0.15],
  Organization: ['navigate', 0.4],
  LocalBusiness: ['navigate', 0.4],
  SoftwareApplication: ['do', 0.55],
};

function scoreLexicon(text: string, lex: string[]): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const w of lex) if (lower.includes(w)) hits++;
  if (hits === 0) return 0;
  // Saturate quickly: 1 hit → 0.35, 2 → 0.55, 3+ → 0.7
  return Math.min(0.7, 0.2 + hits * 0.18);
}

export function classifyPageIntent(page: PageInput): IntentSignal {
  const scores: Record<Exclude<PageIntent, 'unknown'>, number> = {
    know: 0, do: 0, buy: 0, navigate: 0,
  };

  const path = (() => {
    if (page.path) return page.path;
    try { return new URL(page.url).pathname; } catch { return '/'; }
  })();

  // 1) URL pattern (strong signal)
  for (const [re, intent, w] of URL_PATTERNS) {
    if (re.test(path)) {
      scores[intent] = Math.max(scores[intent], w);
    }
  }

  // 2) Lexicon on title + h1 + meta
  const haystack = [page.title, page.h1, page.meta_description].filter(Boolean).join(' ');
  scores.know     = Math.max(scores.know,     scoreLexicon(haystack, LEX_KNOW));
  scores.do       = Math.max(scores.do,       scoreLexicon(haystack, LEX_DO));
  scores.buy      = Math.max(scores.buy,      scoreLexicon(haystack, LEX_BUY));
  scores.navigate = Math.max(scores.navigate, scoreLexicon(haystack, LEX_NAVIGATE));

  // 3) Schema.org boost
  for (const t of (page.schema_org_types || [])) {
    const hint = SCHEMA_HINTS[t];
    if (hint) {
      const [intent, w] = hint;
      scores[intent] = Math.min(1, scores[intent] + w * 0.3);
    }
  }

  // 4) Soft heuristics: long-form (>800 mots) → +know
  if ((page.word_count || 0) > 800) scores.know = Math.min(1, scores.know + 0.1);
  // Many external links → likely informational
  if ((page.external_links || 0) >= 5) scores.know = Math.min(1, scores.know + 0.05);

  // Pick the winning intent
  const entries = Object.entries(scores) as Array<[Exclude<PageIntent, 'unknown'>, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const [topIntent, topScore] = entries[0];
  const secondScore = entries[1]?.[1] ?? 0;

  // Confidence = top score, penalised when 2nd is close
  const margin = topScore - secondScore;
  const confidence = Math.max(0, Math.min(1, topScore - (margin < 0.15 ? 0.1 : 0)));

  return {
    intent: confidence >= CONFIDENCE_THRESHOLD ? topIntent : 'unknown',
    confidence: Number(confidence.toFixed(2)),
    rawIntent: topIntent,
    scores,
  };
}

export function aggregateIntents(
  pages: Array<{ page_intent?: string | null; intent_confidence?: number | null }>,
): {
  total: number;
  by_intent: Record<PageIntent, number>;
  avg_confidence: number;
  unknown_pct: number;
} {
  const by_intent: Record<PageIntent, number> = { know: 0, do: 0, buy: 0, navigate: 0, unknown: 0 };
  let confSum = 0, confCount = 0;
  for (const p of pages) {
    const intent = (p.page_intent as PageIntent) || 'unknown';
    by_intent[intent] = (by_intent[intent] || 0) + 1;
    if (typeof p.intent_confidence === 'number') {
      confSum += p.intent_confidence; confCount++;
    }
  }
  const total = pages.length || 1;
  return {
    total: pages.length,
    by_intent,
    avg_confidence: confCount ? Number((confSum / confCount).toFixed(2)) : 0,
    unknown_pct: Number(((by_intent.unknown / total) * 100).toFixed(1)),
  };
}
