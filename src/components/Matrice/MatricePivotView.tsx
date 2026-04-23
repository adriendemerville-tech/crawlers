/**
 * MatricePivotView — Pivot table powered by @tanstack/react-table.
 * Features: sorting, global filter, expand/collapse families, row totals, heatmap toggle.
 * Charte: bordered, no bg fill, violet → gold heatmap (no IA-blue), no emoji.
 */

import { useMemo, useState, Fragment } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreToHeatClasses } from '@/utils/matrice/heatmapScale';
import { buildPivot, type PivotRow } from '@/utils/matrice/pivotTransform';
import type { MatrixResult } from '@/utils/matrice/matrixOrchestrator';

export interface MatricePivotViewProps {
  results: MatrixResult[];
  className?: string;
  /** Sprint 5 — externally selected family (highlights the row, auto-expands). */
  selectedFamilyId?: string | null;
  /** Sprint 5 — fired when the user clicks a family label. */
  onFamilyClick?: (familyId: string | null) => void;
}

export function MatricePivotView({
  results,
  className,
  selectedFamilyId,
  onFamilyClick,
}: MatricePivotViewProps) {
  const [heatmapOn, setHeatmapOn] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const pivot = useMemo(() => buildPivot(results), [results]);

  // Auto-expand the externally selected family.
  useMemo(() => {
    if (selectedFamilyId) {
      setExpanded(prev => ({ ...prev, [selectedFamilyId]: true }));
    }
  }, [selectedFamilyId]);

  const toggleExpanded = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleFamilyClick = (id: string) => {
    toggleExpanded(id);
    if (onFamilyClick) {
      onFamilyClick(selectedFamilyId === id ? null : id);
    }
  };

  const columns = useMemo<ColumnDef<PivotRow>[]>(() => {
    const cols: ColumnDef<PivotRow>[] = [
      {
        id: 'family',
        accessorKey: 'familyLabel',
        header: 'Famille',
        cell: ({ row }) => {
          const isOpen = !!expanded[row.original.familyId];
          return (
            <button
              type="button"
              onClick={() => toggleExpanded(row.original.familyId)}
              className="inline-flex items-center gap-1.5 text-left font-medium text-foreground hover:text-brand-violet transition-colors bg-transparent"
              aria-expanded={isOpen}
              aria-label={`${isOpen ? 'Réduire' : 'Étendre'} ${row.original.familyLabel}`}
            >
              {isOpen
                ? <ChevronDown className="h-4 w-4 text-brand-violet" aria-hidden />
                : <ChevronRight className="h-4 w-4 text-brand-violet" aria-hidden />}
              {row.original.familyLabel}
              <span className="text-xs text-muted-foreground font-mono">
                ({row.original.totalCount})
              </span>
            </button>
          );
        },
      },
    ];

    for (const col of pivot.columns) {
      cols.push({
        id: col.id,
        accessorFn: (row) => row.cells[col.id]?.score ?? -1,
        header: col.label,
        cell: ({ row }) => {
          const cell = row.original.cells[col.id];
          const v = cell?.score ?? null;
          return (
            <div
              className={cn(
                'px-2 py-1 rounded text-center font-mono transition-colors',
                heatmapOn && v != null && scoreToHeatClasses(v),
              )}
              title={cell ? `${cell.count} critère${cell.count > 1 ? 's' : ''}` : undefined}
            >
              {v != null ? v : '—'}
            </div>
          );
        },
        sortingFn: 'basic',
      });
    }

    cols.push({
      id: 'total',
      accessorKey: 'totalScore',
      header: 'Total',
      cell: ({ row }) => {
        const v = row.original.totalScore;
        return (
          <div
            className={cn(
              'px-2 py-1 rounded text-center font-mono font-semibold transition-colors',
              heatmapOn && v != null && scoreToHeatClasses(v),
            )}
          >
            {v != null ? v : '—'}
          </div>
        );
      },
      sortingFn: 'basic',
    });

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pivot.columns, heatmapOn, expanded]);

  const table = useReactTable({
    data: pivot.rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, value) => {
      const v = String(value).toLowerCase();
      return row.original.familyLabel.toLowerCase().includes(v) ||
        row.original.children?.some(c => c.criterionTitle.toLowerCase().includes(v)) || false;
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (results.length === 0) {
    return (
      <div className={cn(
        'p-8 text-center text-sm text-muted-foreground',
        'border-2 border-dashed border-brand-violet rounded-md bg-transparent',
        className,
      )}>
        Aucun résultat à afficher. Lancez un audit pour peupler la matrice.
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-foreground">Vue Pivot</h3>
          {pivot.globalScore != null && (
            <span className="text-xs font-mono text-brand-gold">
              Global : {pivot.globalScore}/100
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Filtrer…"
              className="pl-7 pr-2 py-1 text-xs bg-transparent border border-brand-violet rounded-md focus:outline-none focus:border-brand-gold w-44"
              aria-label="Filtrer la matrice"
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={heatmapOn}
              onChange={(e) => setHeatmapOn(e.target.checked)}
              className="accent-brand-violet"
            />
            <span>Heatmap</span>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto border-2 border-brand-violet rounded-md bg-transparent">
        <table className="w-full text-sm border-collapse">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-brand-violet/40',
                        header.column.id === 'family' ? 'text-left' : 'text-center',
                      )}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 hover:text-foreground transition-colors bg-transparent"
                          aria-label={`Trier par ${String(header.column.columnDef.header)}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' && <ArrowUp className="h-3 w-3" aria-hidden />}
                          {sorted === 'desc' && <ArrowDown className="h-3 w-3" aria-hidden />}
                          {!sorted && <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />}
                        </button>
                      ) : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => {
              const isOpen = !!expanded[row.original.familyId];
              return (
                <Fragment key={row.id}>
                  <tr className="hover:bg-brand-violet/5 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className={cn(
                          'px-3 py-2 border-b border-brand-violet/20',
                          cell.column.id === 'family' ? 'text-left' : 'text-center',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {isOpen && row.original.children?.map(child => (
                    <tr key={child.criterionId} className="text-xs">
                      <td className="pl-9 pr-3 py-1.5 text-muted-foreground border-b border-brand-violet/10">
                        {child.criterionTitle}
                      </td>
                      <td colSpan={pivot.columns.length} className="px-3 py-1.5 text-center text-muted-foreground border-b border-brand-violet/10">
                        <span className="font-mono">{child.matchType}</span>
                      </td>
                      <td className={cn(
                        'px-3 py-1.5 text-center font-mono border-b border-brand-violet/10',
                        heatmapOn && child.parsedScore != null && scoreToHeatClasses(child.parsedScore),
                      )}>
                        {child.parsedScore ?? '—'}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={pivot.columns.length + 2}
                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                >
                  Aucune famille ne correspond au filtre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Cliquez sur une famille pour voir le détail des critères. Tri par colonne disponible.
      </p>
    </div>
  );
}

export default MatricePivotView;
