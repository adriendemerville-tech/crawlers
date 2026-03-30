import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { FileText, Plug, Loader2, Check } from 'lucide-react';
import { FixConfig } from './types';

interface ContentDelegationSectionProps {
  contentFixes: FixConfig[];
  hasCmsConnection: boolean;
  contentStatus: 'idle' | 'generating' | 'ready' | 'deployed';
}

/**
 * Shows content-type recommendations that will be handled by Content Architect
 * instead of code injection, when a CMS is connected.
 */
export function ContentDelegationSection({ contentFixes, hasCmsConnection, contentStatus }: ContentDelegationSectionProps) {
  const enabledContentFixes = contentFixes.filter(f => f.enabled);

  if (enabledContentFixes.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-amber-500/20">
            <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-xs font-semibold text-foreground">
            Contenu <span className="font-normal text-muted-foreground">via Content Architect</span>
          </span>
        </div>
        {hasCmsConnection ? (
          <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            CMS connecté
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
            <Plug className="w-2.5 h-2.5" />
            CMS requis
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        {enabledContentFixes.map((fix) => (
          <div key={fix.id} className="flex items-center justify-between py-1 px-2 rounded bg-background/50">
            <span className="text-[11px] text-foreground">{fix.label}</span>
            <ContentFixStatus status={contentStatus} hasCms={hasCmsConnection} />
          </div>
        ))}
      </div>

      {hasCmsConnection ? (
        <p className="text-[10px] text-muted-foreground leading-snug">
          Ces modifications seront poussées directement dans votre CMS en même temps que le code correctif.
        </p>
      ) : (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug">
          ⚠ Connectez votre CMS pour déployer automatiquement. Sans connexion, un fallback JS sera utilisé.
        </p>
      )}
    </motion.div>
  );
}

function ContentFixStatus({ status, hasCms }: { status: string; hasCms: boolean }) {
  if (!hasCms) {
    return <span className="text-[9px] text-amber-500">Fallback JS</span>;
  }
  switch (status) {
    case 'generating':
      return (
        <span className="flex items-center gap-1 text-[9px] text-amber-500">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          Préparation…
        </span>
      );
    case 'ready':
      return <span className="text-[9px] text-blue-500">Prêt</span>;
    case 'deployed':
      return (
        <span className="flex items-center gap-1 text-[9px] text-emerald-500">
          <Check className="w-2.5 h-2.5" />
          Déployé
        </span>
      );
    default:
      return <span className="text-[9px] text-muted-foreground">En attente</span>;
  }
}
