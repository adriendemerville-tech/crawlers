/**
 * MachineLayerCTA — composant unifié pour proposer un scan Machine Layer
 * depuis n'importe quel ancrage de l'app.
 *
 * Source unique de vérité pour :
 *  - le copy (varie selon `source`)
 *  - le statut (jamais scanné / scan frais / scan obsolète) via useMachineLayerStatus
 *  - la navigation vers /app/machine-layer (avec ?url= pré-rempli)
 *  - (futur) tracking analytics + cadence anti-saturation
 *
 * Variantes visuelles :
 *  - 'header-button' : bouton compact pour header de page (ancrage permanent #0)
 *  - 'inline'        : bouton standard à insérer dans une card existante
 *  - 'hero'          : carte pleine largeur (post-audit GEO)
 *  - 'task-row'      : ligne dans un workbench (Spiral findings)
 *  - 'wizard-step'   : étape dans onboarding
 *  - 'toast'         : notification post-publication
 */
import { useNavigate } from 'react-router-dom';
import { Sparkles, ScanLine, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useMachineLayerStatus, formatRelativeAge } from '@/hooks/useMachineLayerStatus';

export type MachineLayerSource =
  | 'console_geo_header'   // ancrage #0 — bouton permanent header GEO
  | 'post_geo_audit'       // #1
  | 'onboarding_wizard'    // #2
  | 'console_inline'       // #3
  | 'post_publish_toast'   // #4
  | 'spiral_finding'       // #5
  | 'manual';              // fallback (lien direct)

export type MachineLayerVariant =
  | 'header-button'
  | 'inline'
  | 'hero'
  | 'task-row'
  | 'wizard-step'
  | 'toast';

interface Props {
  /** URL exacte à scanner. Si absente, on utilise `domain`. */
  url?: string | null;
  /** Domaine de référence (utilisé pour le statut + pré-remplissage si url absente). */
  domain?: string | null;
  /** D'où vient le CTA (analytics + copy contextuel). */
  source: MachineLayerSource;
  /** Forme visuelle. Défaut = 'inline'. */
  variant?: MachineLayerVariant;
  /** Classe additionnelle. */
  className?: string;
}

/** Copy contextuel par source — varier le wording évite l'effet "popup cookie". */
const COPY: Record<MachineLayerSource, { idle: string; fresh: string; stale: string; sub?: string }> = {
  console_geo_header: {
    idle: 'Scanner machine layer',
    fresh: 'Voir le machine layer',
    stale: 'Re-scanner machine layer',
  },
  post_geo_audit: {
    idle: 'Compléter avec un scan machine',
    fresh: 'Machine layer — voir le détail',
    stale: 'Rafraîchir le scan machine',
    sub: 'Mesure ce que les bots IA voient réellement (30 sec)',
  },
  onboarding_wizard: {
    idle: 'Lancer le scan machine layer',
    fresh: 'Scan terminé — continuer',
    stale: 'Rafraîchir avant de continuer',
    sub: 'Audit rapide des signaux machine-readable',
  },
  console_inline: {
    idle: 'Scanner cette page',
    fresh: 'Résultat machine layer',
    stale: 'Re-scanner',
  },
  post_publish_toast: {
    idle: 'Vérifier les signaux machine',
    fresh: 'Signaux machine OK',
    stale: 'Re-vérifier les signaux',
  },
  spiral_finding: {
    idle: 'Diagnostiquer (machine layer)',
    fresh: 'Voir diagnostic machine',
    stale: 'Re-diagnostiquer',
  },
  manual: {
    idle: 'Lancer le scan',
    fresh: 'Voir le résultat',
    stale: 'Re-scanner',
  },
};

function buildHref(url?: string | null, domain?: string | null, source?: MachineLayerSource): string {
  const params = new URLSearchParams();
  const target = url || (domain ? `https://${domain}` : null);
  if (target) params.set('url', target);
  if (source) params.set('src', source);
  const qs = params.toString();
  return `/app/machine-layer${qs ? `?${qs}` : ''}`;
}

export function MachineLayerCTA({
  url,
  domain,
  source,
  variant = 'inline',
  className,
}: Props) {
  const navigate = useNavigate();
  const { status, score, scannedAt } = useMachineLayerStatus({ url, domain });
  const copy = COPY[source];
  const href = buildHref(url, domain, source);

  // État affiché : on traite 'loading' et 'error' comme 'idle' pour ne pas bloquer le CTA.
  const displayState: 'idle' | 'fresh' | 'stale' =
    status === 'fresh' ? 'fresh' : status === 'stale' ? 'stale' : 'idle';

  const label = copy[displayState];

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // TODO P4 — tracking analytics : log {source, variant, action:'clicked', url, status}
    navigate(href);
  };

  const Icon =
    displayState === 'fresh' ? CheckCircle2 :
    displayState === 'stale' ? RefreshCw :
    ScanLine;

  // ── Variant: header-button (ancrage #0 — permanent, discret) ─────────────
  if (variant === 'header-button') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        className={cn('gap-2', className)}
        title={
          displayState === 'fresh' && scannedAt
            ? `Dernier scan : ${formatRelativeAge(scannedAt)}${score != null ? ` — score ${score}/100` : ''}`
            : 'Audit rapide des signaux machine-readable de la page (30 sec)'
        }
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}</span>
        {displayState === 'fresh' && score != null && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5">
            {score}
          </Badge>
        )}
      </Button>
    );
  }

  // ── Variant: hero (post-audit GEO, pleine largeur) ───────────────────────
  if (variant === 'hero') {
    return (
      <Card className={cn('border-primary/30 bg-gradient-to-br from-primary/5 to-transparent', className)}>
        <CardContent className="p-5 flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{label}</p>
            {copy.sub && <p className="text-xs text-muted-foreground mt-0.5">{copy.sub}</p>}
            {displayState === 'fresh' && scannedAt && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Scanné {formatRelativeAge(scannedAt)}
                {score != null && ` — score ${score}/100`}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleClick} className="shrink-0 gap-1.5">
            <Icon className="h-3.5 w-3.5" />
            {displayState === 'fresh' ? 'Voir' : 'Lancer'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Variant: task-row (Parménion / workbench) ────────────────────────────
  if (variant === 'task-row') {
    return (
      <div className={cn('flex items-center justify-between gap-3 py-2 px-3 rounded-md border border-border/50 hover:bg-muted/30 transition-colors', className)}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-sm truncate">{label}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleClick} className="shrink-0">
          Ouvrir
        </Button>
      </div>
    );
  }

  // ── Variant: wizard-step ─────────────────────────────────────────────────
  if (variant === 'wizard-step') {
    return (
      <div className={cn('flex flex-col items-center text-center gap-3 py-4', className)}>
        <Icon className="h-8 w-8 text-primary" />
        <div>
          <p className="font-semibold">{label}</p>
          {copy.sub && <p className="text-xs text-muted-foreground mt-1">{copy.sub}</p>}
        </div>
        <Button variant="outline" onClick={handleClick} className="gap-2">
          <Sparkles className="h-4 w-4" />
          {displayState === 'fresh' ? 'Continuer' : 'Démarrer le scan'}
        </Button>
      </div>
    );
  }

  // ── Variant: toast (post-publication CMS) ────────────────────────────────
  if (variant === 'toast') {
    return (
      <button
        onClick={handleClick}
        className={cn('inline-flex items-center gap-2 text-sm underline-offset-2 hover:underline text-primary', className)}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  // ── Variant: inline (défaut) ─────────────────────────────────────────────
  return (
    <Button variant="outline" size="sm" onClick={handleClick} className={cn('gap-2', className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
      {displayState === 'fresh' && score != null && (
        <Badge variant="secondary" className="h-4 px-1 text-[10px]">{score}</Badge>
      )}
    </Button>
  );
}
