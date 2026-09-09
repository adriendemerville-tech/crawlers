import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@/lib/router-compat';
import { ArrowRight, CornerDownLeft } from 'lucide-react';

/**
 * Aiguillage d'audience — première fenêtre de la home.
 *
 * Une seule URL indexable : tout le contenu de la home reste dans le DOM SSR,
 * ce bloc s'affiche par-dessus le premier écran côté client uniquement.
 * Selon la réponse, on redirige vers la landing dirigeants (/audit-geo-seo)
 * ou on révèle la home actuelle (profils SEO/GEO avancés).
 *
 * Le choix est persisté en cookie (90 jours, accessible au SSR) ET en localStorage
 * pour que l'aiguillage ne réapparaisse pas lors des visites suivantes.
 *
 * Classification 100 % déterministe et locale : aucun appel LLM, aucun token.
 */

const STORAGE_KEY = 'crawlers_audience_choice';
const COOKIE_NAME = 'crawlers_audience_choice';
const COOKIE_MAX_AGE_DAYS = 90;

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function getStoredChoice(): AudienceChoice | null {
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local === 'business' || local === 'pro') return local;
  } catch {
    /* ignore */
  }
  const cookie = getCookie(COOKIE_NAME);
  if (cookie === 'business' || cookie === 'pro') return cookie;
  return null;
}

function persistChoice(choice: AudienceChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* ignore */
  }
  setCookie(COOKIE_NAME, choice, COOKIE_MAX_AGE_DAYS);
}

/** Signaux « dirigeant / TPE-PME » : résultat commercial, pas de vocabulaire métier. */
const BUSINESS_SIGNALS = [
  'client', 'clients', 'vendre', 'ventes', 'vente', 'chiffre', 'affaires', 'ca',
  'devis', 'prospect', 'prospects', 'commande', 'commandes', 'boutique', 'ecommerce',
  'e-commerce', 'artisan', 'restaurant', 'cabinet', 'commerce', 'entreprise',
  'societe', 'société', 'tpe', 'pme', 'visible', 'visibilite', 'visibilité',
  'trouve', 'trouvé', 'trouver', 'connu', 'notoriete', 'notoriété', 'recommande',
  'recommandé', 'chatgpt', 'gemini', 'perplexity', 'ia', 'debutant', 'débutant',
  'pas technique', 'comprends rien', 'aide', 'accompagnement', 'clef en main',
  'cle en main', 'clé en main', 'demarrer', 'démarrer', 'lancer',
];

/** Signaux « professionnel SEO/GEO » : vocabulaire et outillage métier. */
const PRO_SIGNALS = [
  'agence', 'consultant', 'freelance', 'seo', 'geo', 'crawl', 'crawler', 'crawling',
  'logs', 'log', 'api', 'mcp', 'sitemap', 'canonical', 'canonique', 'maillage',
  'cocon', 'netlinking', 'backlink', 'backlinks', 'schema', 'jsonld', 'json-ld',
  'balise', 'balises', 'hreflang', 'robots', 'indexation', 'serp', 'serps',
  'positions', 'ranking', 'kpi', 'gsc', 'search console', 'ga4', 'analytics',
  'semrush', 'ahrefs', 'screaming', 'frog', 'majestic', 'dataforseo', 'audit technique',
  'core web vitals', 'lcp', 'inp', 'cls', 'redirection', 'redirections', 'migration',
  'portefeuille', 'reporting', 'white label', 'marque blanche', 'equipe', 'équipe',
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ');
}

function countSignals(text: string, signals: string[]): number {
  const normalized = normalize(text);
  const words = new Set(normalized.split(/\s+/).filter(Boolean));
  let score = 0;
  for (const signal of signals) {
    const s = normalize(signal);
    if (s.includes(' ')) {
      if (normalized.includes(s)) score += 2;
    } else if (words.has(s)) {
      score += 1;
    }
  }
  return score;
}

export type AudienceChoice = 'business' | 'pro';

export function classifyAudience(answer: string): AudienceChoice {
  const business = countSignals(answer, BUSINESS_SIGNALS);
  const pro = countSignals(answer, PRO_SIGNALS);
  // Égalité ou réponse vide : on garde la home complète (aucune perte de contenu).
  return business > pro ? 'business' : 'pro';
}

export function AudienceRouter() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Client-only : jamais rendu en SSR, donc aucun impact sur le HTML indexé.
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      /* stockage indisponible : on affiche l'aiguillage une fois */
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) inputRef.current?.focus();
  }, [visible]);

  const remember = (choice: AudienceChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
  };

  const apply = (choice: AudienceChoice) => {
    remember(choice);
    if (choice === 'business') {
      navigate('/audit-geo-seo');
      return;
    }
    setVisible(false);
  };

  const submit = () => {
    if (!answer.trim() || thinking) return;
    setThinking(true);
    const choice = classifyAudience(answer);
    // Court délai : la réponse s'affiche avant la bascule, sans faire attendre.
    window.setTimeout(() => apply(choice), 700);
  };

  const placeholder = useMemo(
    () =>
      'Ex. : je veux que mon entreprise soit citée par ChatGPT et trouvée sur Google — ou : j\'audite les sites de mes clients',
    [],
  );

  if (!visible) return null;

  return (
    <section
      aria-label="Orientation du visiteur"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background px-5 py-10 animate-fade-in"
    >
      <div className="w-full max-w-2xl">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Crawlers</p>
        <h2 className="text-2xl font-semibold leading-tight text-foreground sm:text-4xl">
          Pourquoi avez-vous besoin de Crawlers&nbsp;?
        </h2>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Répondez en une phrase. On vous montre directement ce qui vous concerne.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-card/60 p-3 backdrop-blur-sm">
          <textarea
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={3}
            disabled={thinking}
            placeholder={placeholder}
            aria-label="Pourquoi avez-vous besoin de Crawlers ?"
            className="w-full resize-none bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 sm:text-base"
          />
          <div className="mt-2 flex items-center justify-between gap-3 px-2">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <CornerDownLeft className="h-3.5 w-3.5" />
              Entrée pour valider
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!answer.trim() || thinking}
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-foreground/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-foreground disabled:opacity-40"
            >
              {thinking ? 'Un instant…' : 'Continuer'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => apply('business')}
            className="flex-1 rounded-xl border border-border px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-foreground/60"
          >
            <span className="block font-medium">Je dirige une entreprise</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Je veux plus de clients via Google et les IA
            </span>
          </button>
          <button
            type="button"
            onClick={() => apply('pro')}
            className="flex-1 rounded-xl border border-border px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-foreground/60"
          >
            <span className="block font-medium">Je fais du SEO / GEO</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Agence, consultant, équipe interne : je veux la plateforme
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => apply('pro')}
          className="mt-6 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Voir le site sans répondre
        </button>
      </div>
    </section>
  );
}

export default AudienceRouter;
