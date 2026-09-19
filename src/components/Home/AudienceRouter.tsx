import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@/lib/router-compat';
import { Mic, Plus } from 'lucide-react';

/**
 * Aiguillage d'audience — première fenêtre de la home, style Claude minimaliste.
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
const THINKING_DELAY_MS = 2000;

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

/** Écart minimal de signaux pour trancher sans reposer de question. */
const MIN_MARGIN = 2;

export function classifyAudience(answer: string): AudienceChoice {
  const business = countSignals(answer, BUSINESS_SIGNALS);
  const pro = countSignals(answer, PRO_SIGNALS);
  // Égalité ou réponse vide : on garde la home complète (aucune perte de contenu).
  return business > pro ? 'business' : 'pro';
}

/**
 * Classification prudente : renvoie 'unknown' quand la réponse ne tranche pas
 * (ex. « le site de mon garage auto »), pour reposer une question de lever de doute
 * au lieu d'aiguiller à tort vers la landing agences.
 */
export function classifyAudienceOrAsk(answer: string): AudienceChoice | 'unknown' {
  const business = countSignals(answer, BUSINESS_SIGNALS);
  const pro = countSignals(answer, PRO_SIGNALS);
  if (Math.abs(business - pro) < MIN_MARGIN) return 'unknown';
  return business > pro ? 'business' : 'pro';
}


function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function CrawlersLogoPulse({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/crawlers-logo-violet.png"
      alt="Crawlers"
      style={{ height: size, width: 'auto' }}
      className="animate-pulse"
    />
  );
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function AudienceRouter() {
  const navigate = useNavigate();
  // Visible dès le rendu initial : évite d'afficher la home avant l'aiguillage.
  const [visible, setVisible] = useState(true);
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);
  const [clarify, setClarify] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Le choix mémorisé retire l'aiguillage dès l'hydratation.
  useEffect(() => {
    if (getStoredChoice()) setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  useEffect(() => {
    if (visible && !thinking && !clarify && !isListening) inputRef.current?.focus();
  }, [visible, thinking, clarify, isListening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const apply = (choice: AudienceChoice) => {
    persistChoice(choice);
    if (choice === 'business') {
      navigate('/audit-geo-seo');
      return;
    }
    setVisible(false);
  };

  const submit = () => {
    if (!answer.trim() || thinking) return;
    recognitionRef.current?.abort();
    setIsListening(false);
    setThinking(true);
    const verdict = classifyAudienceOrAsk(answer);
    window.setTimeout(() => {
      setThinking(false);
      if (verdict === 'unknown') {
        setClarify(true);
        return;
      }
      apply(verdict);
    }, THINKING_DELAY_MS);
  };


  const toggleVoice = () => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      // API non disponible : on ne bloque pas la saisie manuelle.
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results;
      let interim = '';
      let final = '';
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      setAnswer((prev) => {
        const base = final ? `${prev ? prev + ' ' : ''}${final}`.trim() : prev;
        return interim ? `${base}${base ? ' ' : ''}${interim}`.trim() : base;
      });
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const placeholder = useMemo(() => 'Poser une question', []);

  if (!visible) return null;

  return (
    <section
      aria-label="Orientation du visiteur"
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50 flex min-h-dvh w-full items-center justify-center overflow-y-auto bg-background px-4 py-8 sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <img
          src="/crawlers-logo-violet.png"
          alt="Crawlers"
          className="mb-10 h-12 w-auto sm:h-14"
        />
        {thinking ? (
          <div className="flex min-h-48 items-center justify-center gap-8 text-base text-muted-foreground">
            <CrawlersLogoPulse size={32} />
            <span>Crawlers réfléchit…</span>
          </div>
        ) : clarify ? (
          <div className="flex w-full flex-col items-center gap-8">
            <h2 className="t-h2 max-w-2xl font-display font-bold text-foreground">
              Vous occupez-vous vous-même de votre site ou êtes-vous professionnel du référencement ?
            </h2>
            <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => apply('business')}
                className="min-h-11 rounded-full border border-foreground/40 px-5 py-2.5 text-sm text-foreground transition-colors hover:border-foreground hover:bg-foreground/5"
              >
                Je m'occupe de mon site
              </button>
              <button
                type="button"
                onClick={() => apply('pro')}
                className="min-h-11 rounded-full border border-foreground/40 px-5 py-2.5 text-sm text-foreground transition-colors hover:border-foreground hover:bg-foreground/5"
              >
                Je suis pro SEO
              </button>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center">
            <h2 className="audience-router-question mb-8 whitespace-nowrap font-display font-bold text-foreground">
              Pourquoi avez-vous besoin de Crawlers ?
            </h2>
            <div className="flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-border bg-secondary/30 p-2 sm:p-3">
              <input
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={placeholder}
                aria-label="Pourquoi avez-vous besoin de Crawlers ?"
                className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={isListening ? 'Arrêter la dictée vocale' : 'Dictée vocale'}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isListening
                    ? 'border-brand-violet text-brand-violet hover:bg-brand-violet/10'
                    : 'border-foreground/30 text-foreground hover:border-foreground hover:bg-foreground/5'
                }`}
              >
                <Mic className={`h-4 w-4 ${isListening ? 'animate-pulse' : ''}`} />
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!answer.trim()}
                aria-label="Envoyer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-foreground/30 text-foreground transition-colors hover:border-foreground hover:bg-foreground/5 disabled:opacity-30"
              >
                <SendIcon />
              </button>
            </div>
            <button
              type="button"
              onClick={() => apply('pro')}
              className="mt-6 min-h-11 border-0 bg-transparent px-3 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Voir le site sans répondre
            </button>
          </div>
        )}
      </div>
    </section>
  );

}

export default AudienceRouter;
