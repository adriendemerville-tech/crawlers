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

function CrawlersLogoPulse() {
  return (
    <div className="relative flex items-center justify-center">
      <img
        src="/crawlers-logo-violet.png"
        alt="Crawlers"
        className="h-10 w-auto animate-pulse"
      />
      <span className="absolute -bottom-6 text-xs tracking-wide text-muted-foreground">
        Crawlers réfléchit…
      </span>
    </div>
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
  const [visible, setVisible] = useState(false);
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);
  const [clarify, setClarify] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Client-only : jamais rendu en SSR, donc aucun impact sur le HTML indexé.
  useEffect(() => {
    if (getStoredChoice()) return;
    setVisible(true);
  }, []);

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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-4 animate-fade-in"
    >
      {thinking ? (
        <div className="flex flex-col items-center justify-center">
          <CrawlersLogoPulse />
        </div>
      ) : (
        <div className="flex w-full max-w-3xl flex-col items-center gap-8 px-2 text-center">
          <h2 className="max-w-3xl text-2xl font-medium leading-snug text-foreground sm:text-4xl">
            Pourquoi avez-vous besoin de Crawlers&nbsp;?
          </h2>

          <div className="w-full">
            <div className="flex items-end gap-2 rounded-3xl border border-border bg-secondary/40 px-3 py-3 backdrop-blur-sm">
              <button
                type="button"
                aria-label="Options"
                className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-5 w-5" />
              </button>

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
                rows={1}
                placeholder={placeholder}
                aria-label="Pourquoi avez-vous besoin de Crawlers ?"
                className="max-h-32 min-h-[2rem] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 sm:text-base"
              />

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-label={isListening ? 'Arrêter la dictée vocale' : 'Dictée vocale'}
                  className={`
                    flex h-8 w-8 items-center justify-center rounded-full border transition-colors
                    ${
                      isListening
                        ? 'border-violet-500 text-violet-500 hover:bg-violet-500/10'
                        : 'border-foreground/30 text-foreground hover:border-foreground hover:bg-foreground/5'
                    }
                  `}
                >
                  <Mic className={`h-5 w-5 ${isListening ? 'animate-pulse' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!answer.trim()}
                  aria-label="Envoyer"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/30 text-foreground transition-colors hover:border-foreground hover:bg-foreground/5 disabled:opacity-30"
                >
                  <SendIcon />
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => apply('pro')}
                className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Voir le site sans répondre
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );

}

export default AudienceRouter;
