/**
 * MatriceTypeDetector — Badge displaying detected matrix type + confidence.
 * Charte: bordered, no bg fill, brand colors only.
 */

import { cn } from '@/lib/utils';
import type { DetectionResult, MatriceType } from '@/utils/matrice/typeDetector';

const TYPE_LABEL: Record<MatriceType, string> = {
  seo: 'SEO',
  geo: 'GEO',
  hybrid: 'Hybride',
  benchmark: 'Benchmark',
};

const TYPE_DESCRIPTION: Record<MatriceType, string> = {
  seo: 'Audit technique et on-page',
  geo: 'Visibilité IA générative',
  hybrid: 'Mixte SEO + GEO',
  benchmark: 'Test multi-LLM par prompt',
};

export interface MatriceTypeDetectorProps {
  detection: DetectionResult;
  className?: string;
}

export function MatriceTypeDetector({ detection, className }: MatriceTypeDetectorProps) {
  const { type, confidence } = detection;
  const pct = Math.round(confidence * 100);

  return (
    <div
      className={cn(
        'inline-flex flex-col gap-1 px-3 py-2',
        'border-2 border-brand-violet rounded-md bg-transparent',
        className,
      )}
      role="status"
      aria-label={`Type détecté : ${TYPE_LABEL[type]}, confiance ${pct}%`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Type</span>
        <span className="text-sm font-semibold text-foreground">{TYPE_LABEL[type]}</span>
        <span className="text-xs text-brand-gold font-mono">{pct}%</span>
      </div>
      <p className="text-xs text-muted-foreground">{TYPE_DESCRIPTION[type]}</p>
      {detection.isVariableSheet && (
        <p className="text-xs text-brand-violet">Feuille de variables détectée</p>
      )}
    </div>
  );
}

export default MatriceTypeDetector;
