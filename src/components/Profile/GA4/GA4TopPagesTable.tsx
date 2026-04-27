import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Plus } from 'lucide-react';
import type { GA4PageRow } from './types';

interface Props {
  pages: GA4PageRow[];
  loading?: boolean;
  onAddToSelection?: (path: string) => void;
}

type SortKey = 'pageviews' | 'sessions' | 'conversions';

export function GA4TopPagesTable({ pages, loading, onAddToSelection }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('pageviews');
  const [limit, setLimit] = useState(15);

  const sorted = useMemo(() => {
    return [...pages].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0)).slice(0, limit);
  }, [pages, sortKey, limit]);

  if (loading) {
    return <Card className="h-[280px] animate-pulse bg-muted/40 p-4" />;
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Top pages</div>
      </div>
      <div className="max-h-[280px] overflow-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Page</TableHead>
              <TableHead className="cursor-pointer text-right text-xs" onClick={() => setSortKey('pageviews')}>
                <span className="inline-flex items-center gap-1">
                  Vues <ArrowUpDown className="h-3 w-3 opacity-50" />
                </span>
              </TableHead>
              <TableHead className="cursor-pointer text-right text-xs" onClick={() => setSortKey('sessions')}>
                <span className="inline-flex items-center gap-1">
                  Sessions <ArrowUpDown className="h-3 w-3 opacity-50" />
                </span>
              </TableHead>
              <TableHead className="cursor-pointer text-right text-xs" onClick={() => setSortKey('conversions')}>
                <span className="inline-flex items-center gap-1">
                  Conv. <ArrowUpDown className="h-3 w-3 opacity-50" />
                </span>
              </TableHead>
              {onAddToSelection && <TableHead className="w-8" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => (
              <TableRow key={p.path}>
                <TableCell className="max-w-[280px] truncate text-xs" title={p.path}>
                  {p.path}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">{p.pageviews.toLocaleString('fr-FR')}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{p.sessions.toLocaleString('fr-FR')}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{p.conversions.toLocaleString('fr-FR')}</TableCell>
                {onAddToSelection && (
                  <TableCell className="w-8 p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => onAddToSelection(p.path)}
                      aria-label="Ajouter à la sélection"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pages.length > limit && (
        <Button variant="outline" size="sm" className="mt-2 h-7 w-full text-xs" onClick={() => setLimit(limit + 15)}>
          Voir plus
        </Button>
      )}
    </Card>
  );
}
