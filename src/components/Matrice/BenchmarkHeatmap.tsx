import { useMemo } from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';

/* ── Types ─────────────────────────────────────────────────────────── */

interface BenchmarkResult {
  id: string;
  prompt: string;
  theme: string;
  engine: string;
  crawlers_score: number;
  citation_found: boolean;
  citation_rank: number | null;
  citation_context: string;
  raw_data?: Record<string, any>;
}

interface Props {
  results: BenchmarkResult[];
  themes: string[];
  engines: string[];
  heatmap?: Record<string, Record<string, { score: number; cited: boolean; rank: number | null }>>;
  globalScore: number;
  citationRate: number;
}

/* ── Score color utility ──────────────────────────────────────────── */

function getHeatColor(score: number, cited: boolean): string {
  if (score < 0) return 'bg-muted/30 text-muted-foreground';
  if (cited && score >= 70) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (cited && score >= 40) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (cited) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  if (score >= 70) return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
  if (score >= 40) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20';
  return 'bg-red-500/15 text-red-400 border-red-500/20';
}

function getCitationIcon(cited: boolean, rank: number | null): string {
  if (!cited) return '✗';
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank != null) return `#${rank}`;
  return '✓';
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function BenchmarkHeatmap({ results, themes, engines, heatmap, globalScore, citationRate }: Props) {
  // Build heatmap from results if not provided
  const heatData = useMemo(() => {
    if (heatmap) return heatmap;
    const map: Record<string, Record<string, { score: number; cited: boolean; rank: number | null }>> = {};
    for (const theme of themes) {
      map[theme] = {};
      for (const engine of engines) {
        const match = results.find(r => r.theme === theme && r.engine === engine);
        map[theme][engine] = match
          ? { score: match.crawlers_score, cited: match.citation_found, rank: match.citation_rank }
          : { score: -1, cited: false, rank: null };
      }
    }
    return map;
  }, [results, themes, engines, heatmap]);

  // Per-engine averages
  const engineAvgs = useMemo(() => {
    return engines.map(engine => {
      const engineResults = results.filter(r => r.engine === engine);
      const avg = engineResults.length > 0
        ? Math.round(engineResults.reduce((s, r) => s + r.crawlers_score, 0) / engineResults.length)
        : 0;
      const cited = engineResults.filter(r => r.citation_found).length;
      return { engine, avg, cited, total: engineResults.length };
    });
  }, [results, engines]);

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Score global</span>
          <span className="text-lg font-bold text-foreground">{globalScore}/100</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Taux de citation</span>
          <span className="text-lg font-bold text-primary">{citationRate}%</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {engineAvgs.map(ea => (
            <Badge key={ea.engine} variant="outline" className="text-[10px] gap-1">
              {ea.engine}: {ea.avg}/100 ({ea.cited}/{ea.total} cité)
            </Badge>
          ))}
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[200px]">
                Thème
              </th>
              {engines.map(engine => (
                <th key={engine} className="text-center px-3 py-2 font-semibold text-muted-foreground min-w-[100px]">
                  {engine}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {themes.map((theme, ti) => (
              <tr key={theme} className={ti % 2 === 0 ? '' : 'bg-muted/10'}>
                <td className="px-3 py-2 font-medium text-foreground sticky left-0 bg-background z-10 border-r">
                  <span className="truncate block max-w-[250px]" title={theme}>{theme}</span>
                </td>
                {engines.map(engine => {
                  const cell = heatData[theme]?.[engine];
                  if (!cell || cell.score < 0) {
                    return (
                      <td key={engine} className="text-center px-2 py-2 text-muted-foreground/50">—</td>
                    );
                  }

                  const matchResult = results.find(r => r.theme === theme && r.engine === engine);

                  return (
                    <td key={engine} className="text-center px-1 py-1">
                      <HoverCard openDelay={200}>
                        <HoverCardTrigger asChild>
                          <button className={`inline-flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-md border transition-colors w-full ${getHeatColor(cell.score, cell.cited)}`}>
                            <span className="font-bold text-sm">{cell.score}</span>
                            <span className="text-[10px] opacity-80">{getCitationIcon(cell.cited, cell.rank)}</span>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" className="w-72 text-xs">
                          <p className="font-semibold mb-1">{theme} × {engine}</p>
                          <p className="text-muted-foreground">Score: {cell.score}/100</p>
                          <p className="text-muted-foreground">
                            Citation: {cell.cited ? `Oui (rang ${cell.rank || '?'})` : 'Non détectée'}
                          </p>
                          {matchResult?.citation_context && (
                            <p className="text-muted-foreground mt-1 italic">
                              « {matchResult.citation_context.substring(0, 150)} »
                            </p>
                          )}
                          {matchResult?.raw_data?.engine_response_preview && (
                            <p className="text-muted-foreground/60 mt-1 text-[10px]">
                              {matchResult.raw_data.engine_response_preview.substring(0, 200)}…
                            </p>
                          )}
                        </HoverCardContent>
                      </HoverCard>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" /> Cité + bon score
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" /> Cité + score moyen
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-500/15 border border-blue-500/20" /> Non cité + bon score
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500/15 border border-red-500/20" /> Non cité + mauvais score
        </span>
        <span className="flex items-center gap-1">🥇 = 1er cité · ✓ = cité · ✗ = absent</span>
      </div>
    </div>
  );
}
