import { useMemo, useState } from 'react';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Layers, Grid3X3, Box, Trophy, Medal, Award, Check, X } from 'lucide-react';
import { BenchmarkCube3D } from './BenchmarkCube3D';

/* ── Types ─────────────────────────────────────────────────────────── */

interface BenchmarkResult {
  id: string;
  prompt: string;
  theme: string;
  engine: string;
  axe?: string;
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

/* ── Score color utility (charte: violet / gold / muted, pas de bleu IA) ──── */

function getHeatColor(score: number, cited: boolean): string {
  if (score < 0) return 'bg-muted/30 text-muted-foreground';
  // Cited tiers: gold scale (best) → violet (mid) → muted (low)
  if (cited && score >= 70) return 'bg-brand-gold/25 text-brand-gold border-brand-gold/50';
  if (cited && score >= 40) return 'bg-brand-gold/15 text-brand-gold/90 border-brand-gold/30';
  if (cited) return 'bg-brand-violet/20 text-brand-violet border-brand-violet/40';
  // Not cited: violet faded → muted
  if (score >= 70) return 'bg-brand-violet/15 text-brand-violet/80 border-brand-violet/25';
  if (score >= 40) return 'bg-muted/40 text-muted-foreground border-border';
  return 'bg-muted/20 text-muted-foreground/70 border-border/50';
}

function CitationGlyph({ cited, rank }: { cited: boolean; rank: number | null }) {
  if (!cited) return <X className="h-3 w-3 inline" aria-label="Non cité" />;
  if (rank === 1) return <Trophy className="h-3 w-3 inline text-brand-gold" aria-label="Rang 1" />;
  if (rank === 2) return <Medal className="h-3 w-3 inline text-brand-gold/80" aria-label="Rang 2" />;
  if (rank === 3) return <Award className="h-3 w-3 inline text-brand-gold/60" aria-label="Rang 3" />;
  if (rank != null) return <span className="font-mono text-[10px]">#{rank}</span>;
  return <Check className="h-3 w-3 inline text-brand-violet" aria-label="Cité" />;
}

/* ── Engine color map (charte: violet/gold scale only, pas de bleu IA) ──── */

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: 'bg-brand-violet/15 text-brand-violet border-brand-violet/40 data-[active=true]:bg-brand-violet/30',
  gemini: 'bg-brand-gold/15 text-brand-gold border-brand-gold/40 data-[active=true]:bg-brand-gold/30',
  perplexity: 'bg-brand-violet/20 text-brand-violet border-brand-violet/50 data-[active=true]:bg-brand-violet/35',
  claude: 'bg-brand-gold/20 text-brand-gold border-brand-gold/50 data-[active=true]:bg-brand-gold/35',
  mistral: 'bg-foreground/10 text-foreground border-foreground/20 data-[active=true]:bg-foreground/20',
};

function getEngineColor(engine: string): string {
  const key = engine.toLowerCase();
  for (const [k, v] of Object.entries(ENGINE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return 'bg-muted/30 text-muted-foreground border-border data-[active=true]:bg-muted/50';
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function BenchmarkHeatmap({ results, themes, engines, heatmap, globalScore, citationRate }: Props) {
  // View mode: 'heatmap' (compact grid), 'tabs' (one engine at a time), or 'cube' (3D)
  // Default to heatmap if grid is reasonable (≤6 engines AND ≤30 themes), else fall back to tabs.
  const compactGridFits = engines.length <= 6 && themes.length <= 30;
  const [viewMode, setViewMode] = useState<'heatmap' | 'tabs' | 'cube'>(compactGridFits ? 'heatmap' : 'tabs');
  const [activeEngine, setActiveEngine] = useState<string>(engines[0] || '');

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
      {/* Header stats + view toggle */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Score global</span>
          <span className="text-lg font-bold text-foreground">{globalScore}/100</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Taux de citation</span>
          <span className="text-lg font-bold text-primary">{citationRate}%</span>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant={viewMode === 'heatmap' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setViewMode('heatmap')}
          >
            <Grid3X3 className="h-3.5 w-3.5" /> Heatmap
          </Button>
          <Button
            variant={viewMode === 'tabs' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setViewMode('tabs')}
          >
            <Layers className="h-3.5 w-3.5" /> Par moteur
          </Button>
          <Button
            variant={viewMode === 'cube' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setViewMode('cube')}
          >
            <Box className="h-3.5 w-3.5" /> Cube 3D
          </Button>
        </div>
      </div>

      {/* ── VIEW: Cube 3D (Thème × Moteur × Famille) ────────────────────── */}
      {viewMode === 'cube' && (
        <BenchmarkCube3D results={results} themes={themes} engines={engines} />
      )}


      {/* ── VIEW: Engine tabs (one at a time) ─────────────────────────── */}
      {viewMode === 'tabs' && (
        <div className="space-y-3">
          {/* Engine selector buttons */}
          <div className="flex flex-wrap gap-2">
            {engineAvgs.map(ea => (
              <button
                key={ea.engine}
                data-active={activeEngine === ea.engine}
                onClick={() => setActiveEngine(ea.engine)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${getEngineColor(ea.engine)} ${
                  activeEngine === ea.engine ? 'ring-1 ring-primary/50 shadow-sm' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <span className="font-semibold">{ea.engine}</span>
                <span className="text-[10px] opacity-80">{ea.avg}/100</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0">
                  {ea.cited}/{ea.total} cité
                </Badge>
              </button>
            ))}
          </div>

          {/* Detail table for active engine */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-10">#</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Thème / Prompt</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground w-20">Score</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground w-16">Cité</th>
                  <th className="text-center px-3 py-2 font-semibold text-muted-foreground w-16">Rang</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Contexte</th>
                </tr>
              </thead>
              <tbody>
                {themes.map((theme, idx) => {
                  const cell = heatData[theme]?.[activeEngine];
                  const matchResult = results.find(r => r.theme === theme && r.engine === activeEngine);
                  const score = cell?.score ?? -1;
                  const cited = cell?.cited ?? false;
                  const rank = cell?.rank ?? null;

                  return (
                    <tr key={theme} className={idx % 2 === 0 ? '' : 'bg-muted/10'}>
                      <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        <span className="block max-w-[400px] truncate" title={theme}>{theme}</span>
                      </td>
                      <td className="text-center px-2 py-1">
                        {score >= 0 ? (
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md border font-bold text-sm ${getHeatColor(score, cited)}`}>
                            {score}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="text-center px-2 py-2">
                        <span className={cited ? 'text-brand-violet font-semibold' : 'text-muted-foreground'}>
                          {cited ? <Check className="h-3.5 w-3.5 inline" /> : <X className="h-3.5 w-3.5 inline" />}
                        </span>
                      </td>
                      <td className="text-center px-2 py-2 font-mono">
                        {rank != null ? <CitationGlyph cited={cited} rank={rank} /> : '—'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <HoverCard openDelay={200}>
                          <HoverCardTrigger asChild>
                            <span className="block max-w-[300px] truncate cursor-help">
                              {matchResult?.citation_context
                                ? matchResult.citation_context.substring(0, 80) + (matchResult.citation_context.length > 80 ? '…' : '')
                                : '—'}
                            </span>
                          </HoverCardTrigger>
                          {matchResult?.citation_context && (
                            <HoverCardContent side="top" className="w-80 text-xs">
                              <p className="font-semibold mb-1">{theme}</p>
                              <p className="text-muted-foreground whitespace-pre-wrap">{matchResult.citation_context}</p>
                              {matchResult?.raw_data?.engine_response_preview && (
                                <p className="text-muted-foreground/60 mt-2 text-[10px] border-t pt-2">
                                  {matchResult.raw_data.engine_response_preview.substring(0, 300)}…
                                </p>
                              )}
                            </HoverCardContent>
                          )}
                        </HoverCard>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── VIEW: Compact heatmap grid (all engines) ──────────────────── */}
      {viewMode === 'heatmap' && (
        <>
          {/* Per-engine badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {engineAvgs.map(ea => (
              <Badge key={ea.engine} variant="outline" className="text-[10px] gap-1">
                {ea.engine}: {ea.avg}/100 ({ea.cited}/{ea.total} cité)
              </Badge>
            ))}
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
                                <span className="text-[10px] opacity-80"><CitationGlyph cited={cell.cited} rank={cell.rank} /></span>
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
        </>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-brand-gold/25 border border-brand-gold/50" /> Cité + bon score
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-brand-gold/15 border border-brand-gold/30" /> Cité + score moyen
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-brand-violet/15 border border-brand-violet/25" /> Non cité + bon score
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-muted/20 border border-border/50" /> Non cité + faible score
        </span>
        <span className="flex items-center gap-1">
          <Trophy className="h-3 w-3 text-brand-gold" /> Rang 1 · <Check className="h-3 w-3 text-brand-violet" /> Cité · <X className="h-3 w-3" /> Absent
        </span>
      </div>
    </div>
  );
}
