import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Copy, ChevronDown, FileWarning, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Verdict = 'cannibalization' | 'watch' | 'normal';

interface QualifiedCluster {
  pages: { url: string; similarity?: number }[];
  pivot_url: string;
  avg_similarity: number;
  template_ratio: number;
  verdict: Verdict;
  verdict_source: string;
  rationale: string;
  recommended_action: string;
}

interface ThinPage {
  url: string;
  thin_score: number;
  useful_words: number;
  kind: string;
  reasons: string[];
}

interface IntegrityReport {
  analyzed_pages: number;
  near_duplicate_confidence?: 'conclusive' | 'inconclusive';
  min_pages_for_confidence?: number;
  similarity_threshold: number;
  sector_tolerance: number;

  near_duplicate: {
    clusters: QualifiedCluster[];
    pages_affected: number;
    cannibalization_clusters: number;
    watch_clusters: number;
    normal_clusters: number;
  };
  thin_content: { pages: ThinPage[]; count: number; avg_thin_score: number };
  llm_calls: number;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  cannibalization: 'Cannibalisation',
  watch: 'À surveiller',
  normal: 'Normal pour le secteur',
};

const VERDICT_CLASS: Record<Verdict, string> = {
  cannibalization: 'border-destructive/50 text-destructive',
  watch: 'border-amber-500/50 text-amber-500',
  normal: 'border-muted-foreground/40 text-muted-foreground',
};

const ACTION_LABEL: Record<string, string> = {
  merge_and_redirect: 'Fusionner + 301 vers le pivot',
  differentiate: 'Différencier les angles et les mots-clés',
  canonicalize: 'Canonicaliser vers le pivot',
  enrich: 'Enrichir le contenu',
  none: 'Aucune action',
};

export function ContentIntegrityPanel({ crawlId }: { crawlId?: string | null }) {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!crawlId) { setReport(null); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('site_crawls')
      .select('content_integrity')
      .eq('id', crawlId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const raw = (data as any)?.content_integrity;
        setReport(raw && typeof raw === 'object' ? (raw as IntegrityReport) : null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [crawlId]);

  if (!crawlId || loading || !report || report.analyzed_pages === 0) return null;

  const nd = report.near_duplicate;
  const thin = report.thin_content;
  const minPages = report.min_pages_for_confidence ?? 30;
  const ndInconclusive = report.near_duplicate_confidence
    ? report.near_duplicate_confidence === 'inconclusive'
    : report.analyzed_pages < minPages;
  if (nd.clusters.length === 0 && thin.count === 0 && !ndInconclusive) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* ── Quasi-doublons ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Copy className="w-4 h-4 text-primary" />
            Contenus quasi dupliqués
          </CardTitle>
          <CardDescription className="text-xs">
            {nd.clusters.length} groupe(s) · {nd.pages_affected} pages concernées · seuil{' '}
            {Math.round(report.similarity_threshold * 100)} % · tolérance secteur{' '}
            {Math.round(report.sector_tolerance * 100)} %
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ndInconclusive && (
            <div className="rounded-md border border-amber-500/40 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
              Résultat non concluant : seulement {report.analyzed_pages} page(s) comparables analysées
              (seuil de confiance {minPages}). L'absence de groupe détecté ne signifie pas l'absence de
              duplication — élargissez le crawl avant de conclure.
            </div>
          )}
          {nd.clusters.length === 0 && !ndInconclusive && (
            <p className="text-xs text-muted-foreground">Aucun groupe de pages similaires détecté.</p>

          )}
          {nd.clusters.map((c, i) => (
            <Collapsible key={i}>
              <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left hover:bg-muted/50">
                <span className="flex items-center gap-2 min-w-0">
                  <Layers className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium truncate">
                    {c.pages.length} pages · {Math.round(c.avg_similarity * 100)} % de similarité
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`text-[10px] ${VERDICT_CLASS[c.verdict]}`}>
                    {VERDICT_LABEL[c.verdict]}
                  </Badge>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 py-2 space-y-2">
                <p className="text-xs text-muted-foreground">{c.rationale}</p>
                <p className="text-xs">
                  <span className="text-muted-foreground">Action conseillée : </span>
                  {ACTION_LABEL[c.recommended_action] || c.recommended_action}
                </p>
                <div className="space-y-1">
                  {c.pages.map((p, j) => (
                    <div key={j} className="text-[11px] font-mono truncate flex items-center gap-2">
                      {p.url === c.pivot_url && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">pivot</Badge>
                      )}
                      <span className="truncate text-muted-foreground">{p.url}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Qualification {c.verdict_source === 'llm' ? 'assistée par IA' : 'déterministe'} · part de gabarit{' '}
                  {Math.round(c.template_ratio * 100)} %
                </p>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {/* ── Contenus pauvres ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-primary" />
            Contenus pauvres
          </CardTitle>
          <CardDescription className="text-xs">
            {thin.count} page(s) · score de minceur moyen {thin.avg_thin_score}/100
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 max-h-80 overflow-y-auto">
          {thin.count === 0 && (
            <p className="text-xs text-muted-foreground">Aucune page sous le seuil de son type de contenu.</p>
          )}
          {thin.pages.map((p, i) => (
            <div key={i} className="rounded-md border border-border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono truncate text-muted-foreground">{p.url}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${p.thin_score >= 80 ? 'border-destructive/50 text-destructive' : 'border-amber-500/50 text-amber-500'}`}
                >
                  {p.thin_score}/100
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {p.useful_words} mots utiles · type {p.kind}
                {p.reasons?.length ? ` · ${p.reasons.join(' ; ')}` : ''}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="md:col-span-2 text-[10px] text-muted-foreground">
        Ces constats sont transmis automatiquement au Workbench, exploité par l'Autopilot Parménion et le Stratège
        Cocoon (fusion, redirection 301, enrichissement).
      </p>
    </div>
  );
}
