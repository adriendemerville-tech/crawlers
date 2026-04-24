/**
 * GSC BigQuery Explorer — read-only dashboard powered by the gsc-bigquery-query function.
 *
 * Shows the 4 high-impact views unlocked by the bulk export:
 *   1. Top queries (30/90d) — beyond the 1000-row API limit
 *   2. Cannibalization candidates — queries ranked by 2+ URLs
 *   3. Long-tail opportunities — 4+ word queries near page 2
 *   4. CTR gap quick-wins — pages on top 10 with low CTR
 */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  siteId: string;
}

type QueryKind =
  | 'top_queries_30d'
  | 'top_queries_90d'
  | 'cannibalization_candidates'
  | 'longtail_opportunities'
  | 'ctr_gap_quickwins';

interface Row {
  query?: string;
  url?: string;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  avg_position?: number;
  url_count?: number;
  word_count?: number;
}

interface QueryResult {
  rows: Row[];
  cache: 'hit' | 'miss';
  bytes_processed: number;
  rows_returned: number;
}

const TAB_KINDS: { id: QueryKind; label: string; description: string }[] = [
  { id: 'top_queries_30d', label: 'Top 30j', description: 'Top des requêtes sans plafond API' },
  { id: 'top_queries_90d', label: 'Top 90j', description: 'Vue trimestrielle complète' },
  { id: 'cannibalization_candidates', label: 'Cannibalisation', description: 'Requêtes captées par 2+ URLs' },
  { id: 'longtail_opportunities', label: 'Longue traîne', description: 'Requêtes 4+ mots, position 8-25' },
  { id: 'ctr_gap_quickwins', label: 'CTR Gap', description: 'Top 10 avec CTR < 5%' },
];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function formatPct(n: number | undefined): string {
  if (typeof n !== 'number') return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function formatPos(n: number | undefined): string {
  if (typeof n !== 'number') return '—';
  return n.toFixed(1);
}

export function GscBigQueryExplorer({ siteId }: Props) {
  const [activeKind, setActiveKind] = useState<QueryKind>('top_queries_30d');
  const [results, setResults] = useState<Record<string, QueryResult | undefined>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const runQuery = async (kind: QueryKind) => {
    setLoading((s) => ({ ...s, [kind]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('gsc-bigquery-query', {
        body: { action: 'query', site_id: siteId, kind, params: { limit: 200 } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults((s) => ({ ...s, [kind]: data }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(`Requête échouée : ${msg}`);
    } finally {
      setLoading((s) => ({ ...s, [kind]: false }));
    }
  };

  const renderTable = (kind: QueryKind, result: QueryResult | undefined) => {
    if (!result) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-sm text-muted-foreground">
          <Database className="h-6 w-6" />
          <p>Cliquez sur « Exécuter » pour interroger BigQuery.</p>
          <Button onClick={() => runQuery(kind)} disabled={loading[kind]}>
            {loading[kind] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Zap className="mr-2 h-4 w-4" />
            Exécuter
          </Button>
        </div>
      );
    }

    const rows = result.rows ?? [];
    if (rows.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Aucun résultat pour cette requête.
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => runQuery(kind)}>Réessayer</Button>
          </div>
        </div>
      );
    }

    const showUrl = kind === 'cannibalization_candidates' || kind === 'ctr_gap_quickwins';
    const showCount = kind === 'cannibalization_candidates';
    const showWords = kind === 'longtail_opportunities';

    return (
      <>
        <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant={result.cache === 'hit' ? 'secondary' : 'outline'}>
              Cache : {result.cache === 'hit' ? 'hit' : 'miss'}
            </Badge>
            <span>{result.rows_returned} lignes</span>
            <span>•</span>
            <span>BQ scan : {formatBytes(result.bytes_processed)}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => runQuery(kind)} disabled={loading[kind]}>
            {loading[kind] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Rafraîchir'}
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Requête</TableHead>
                {showUrl && <TableHead>URL</TableHead>}
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clics</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Position</TableHead>
                {showCount && <TableHead className="text-right">URLs</TableHead>}
                {showWords && <TableHead className="text-right">Mots</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{row.query ?? '—'}</TableCell>
                  {showUrl && (
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={row.url}>
                      {row.url ?? '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">{(row.impressions ?? 0).toLocaleString('fr-FR')}</TableCell>
                  <TableCell className="text-right tabular-nums">{(row.clicks ?? 0).toLocaleString('fr-FR')}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPct(row.ctr)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPos(row.avg_position)}</TableCell>
                  {showCount && <TableCell className="text-right tabular-nums">{row.url_count ?? '—'}</TableCell>}
                  {showWords && <TableCell className="text-right tabular-nums">{row.word_count ?? '—'}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Explorateur GSC BigQuery</CardTitle>
        <CardDescription>
          Interrogez l'export brut Search Console — sans plafond de 1000 lignes ni sampling.
          Les résultats sont mis en cache 6h pour éviter de re-scanner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as QueryKind)}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            {TAB_KINDS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {TAB_KINDS.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-4">
              <p className="mb-3 text-xs text-muted-foreground">{t.description}</p>
              {renderTable(t.id, results[t.id])}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
