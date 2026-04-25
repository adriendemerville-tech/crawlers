/**
 * ChatWindowUnified — version "Félix v2" branchée sur l'orchestrateur unifié.
 *
 * Sprint 6 de la migration "1 backend, N personas".
 * Cohabite avec l'ancien ChatWindow.tsx (2100 lignes) derrière un feature flag
 * `felix_unified` dans localStorage (ou `?felix_v2=1` dans l'URL).
 *
 * Cette version remplace toute la mécanique de messages locaux + appels
 * `agent-felix` par le shell générique `AgentChatShell` qui parle à
 * `copilot-orchestrator` (persona = `felix`). Pas d'archive locale, pas de
 * quiz embarqué : ces flux seront migrés progressivement (Sprints 7-8).
 *
 * Charte couleurs : noir/blanc/violet/jaune d'or, boutons sans fond.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, BellOff, Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AgentChatShell } from '@/components/Copilot/AgentChatShell';
import { CrawlersLogo } from './CrawlersLogo';
import { cn } from '@/lib/utils';

interface ChatWindowUnifiedProps {
  onClose: () => void;
  /** Conservé pour compat avec FloatingChatBubble — non utilisé en v2. */
  triggerOnboarding?: boolean;
  /** Conservé pour compat — non utilisé en v2. */
  onOnboardingConsumed?: () => void;
  /** Conservé pour compat — non utilisé en v2. */
  autoStartCrawlersQuiz?: boolean;
  /** Conservé pour compat — non utilisé en v2. */
  autoEnterpriseContact?: boolean;
  /** Message d'accueil custom (Aide → "Nous écrire"). */
  initialGreeting?: string | null;
  /** Bloc dépliant additionnel — non rendu en v2 (à migrer). */
  initialExpandedGreeting?: string | null;
}

const STARTERS = [
  'Explique-moi mon dernier audit',
  'Ouvre la cocoon',
  'Quels sont mes quick wins SEO ?',
];

export function ChatWindowUnified({ onClose, initialGreeting }: ChatWindowUnifiedProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [muted, setMuted] = useState(() => localStorage.getItem('felix_muted') === '1');
  const [trackedSiteId, setTrackedSiteId] = useState<string | undefined>();
  const [domain, setDomain] = useState<string | undefined>();
  const seededRef = useRef(false);

  // Récupère le 1er site suivi (contexte par défaut Félix).
  useEffect(() => {
    if (!user) return;
    supabase
      .from('tracked_sites')
      .select('id, domain')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTrackedSiteId(data.id);
          setDomain(data.domain);
        }
      });
  }, [user]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem('felix_muted', next ? '1' : '0');
    window.dispatchEvent(new Event('felix_mute_changed'));
  };

  // getContext est passé à useCopilot via AgentChatShell ; on le mémoïse via une
  // fonction simple — l'exécution a lieu à chaque sendMessage.
  const getContext = () => ({
    route: location.pathname,
    tracked_site_id: trackedSiteId,
    domain,
    user_id: user?.id,
    surface: 'felix-bubble',
  });

  // Position : capsule flottante en bas-droite, plein écran si maximisé.
  const positionStyle = maximized
    ? { inset: '4rem 1rem 1rem 1rem' as const }
    : {
        right: 'max(0.25rem, calc((100vw - 72rem) / 2 - 3.5rem))',
        bottom: '5rem',
        width: '24rem',
        height: minimized ? '3rem' : '36rem',
      };

  // Astuce : injecter le greeting initial via un starter visible (lecture seule).
  // L'auto-envoi serait intrusif ; on laisse l'utilisateur cliquer.
  const starters = initialGreeting && !seededRef.current
    ? [initialGreeting, ...STARTERS]
    : STARTERS;
  if (initialGreeting) seededRef.current = true;

  return (
    <div
      className={cn(
        'fixed z-[110] flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl',
      )}
      style={positionStyle}
      role="dialog"
      aria-label="Félix — Copilote"
    >
      {/* Header maison (chrome) — réutilise charte crawlers */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <CrawlersLogo size={28} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">Félix</div>
            <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              Copilot v2 · unifié
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            title={muted ? 'Activer le son' : 'Couper le son'}
          >
            {muted ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => { setMinimized((v) => !v); setMaximized(false); }}
            className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
            aria-label={minimized ? 'Restaurer' : 'Réduire'}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setMaximized((v) => !v); setMinimized(false); }}
            className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
            aria-label={maximized ? 'Réduire' : 'Agrandir'}
          >
            {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-transparent p-1 text-muted-foreground transition hover:border-border hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body — masqué quand minimisé pour gagner du DOM */}
      {!minimized && (
        <div className="flex-1 overflow-hidden">
          <AgentChatShell
            persona="felix"
            title="Félix"
            subtitle="Copilote SAV unifié — questions, audits, navigation"
            starterPrompts={starters}
            getContext={getContext}
            className="h-full"
          />
        </div>
      )}
    </div>
  );
}
