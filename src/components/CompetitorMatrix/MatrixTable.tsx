import { COMPETITOR_TYPE_LABEL, COVERAGE_LABEL, type CoverageState, type MarketKeyword, type MatrixResult } from '@/lib/competitorMatrix/types';

const STATE_CLASS: Record<CoverageState, string> = {
  covered: 'bg-primary/25 text-foreground',
  weak: 'bg-primary/10 text-muted-foreground',
  absent: 'bg-muted text-muted-foreground/60',
  not_applicable: 'bg-transparent text-muted-foreground/40',
  not_measured: 'bg-transparent text-muted-foreground/40',
};

const STATE_MARK: Record<CoverageState, string> = {
  covered: '●',
  weak: '◐',
  absent: '○',
  not_applicable: '–',
  not_measured: '?',
};

function cellTitle(keyword: string, position: number | null, rate: number | null, state: CoverageState) {
  const parts = [`${keyword} — ${COVERAGE_LABEL[state]}`];
  parts.push(position !== null ? `Google : position ${position}` : 'Google : hors top 30');
  parts.push(rate !== null ? `Citation IA : ${Math.round(rate * 100)} % des réponses` : 'Citation IA : non mesurée');
  return parts.join('\n');
}

interface Props {
  matrix: MatrixResult;
  keywords: MarketKeyword[];
}

export function MatrixTable({ matrix, keywords }: Props) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">
            Couverture du site cible et de ses concurrents sur les {keywords.length} mots-clés du marché
          </caption>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th scope="col" className="sticky left-0 z-10 bg-muted/40 p-3 text-left font-semibold">
                Domaine
              </th>
              {keywords.map((kw) => (
                <th key={kw.keyword} scope="col" className="p-2 align-bottom">
                  <span
                    className={`block h-32 w-6 whitespace-nowrap text-left text-xs font-normal ${
                      kw.quickWin ? 'font-medium text-primary' : 'text-muted-foreground'
                    }`}
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    title={`${kw.keyword} — ${kw.volume} recherches/mois, difficulté ${kw.difficulty}${
                      kw.quickWin ? ' — quick win : position 11-30 face à un leader du top 5' : ''
                    }`}
                  >
                    {kw.quickWin ? `${kw.keyword} ·` : kw.keyword}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border bg-primary/5">
              <th scope="row" className="sticky left-0 z-10 bg-primary/5 p-3 text-left font-medium">
                AI Overviews — position 0
              </th>
              {matrix.aiOverviewRow.map((cell) => (
                <td
                  key={cell.keyword}
                  className="p-1 text-center text-xs"
                  title={
                    cell.triggered === null
                      ? 'Relevé indisponible'
                      : cell.domains.length > 0
                        ? `Domaines cités : ${cell.domains.join(', ')}`
                        : 'Aucun AI Overview déclenché'
                  }
                >
                  {cell.triggered === null ? '?' : cell.domains.length || '—'}
                </td>
              ))}
            </tr>
            {matrix.rows.map((row) => (
              <tr key={row.domain} className="border-b border-border last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-background p-3 text-left font-normal">
                  <span className={row.type === 'target' ? 'font-semibold' : ''}>{row.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.type === 'target' ? 'Votre entreprise' : COMPETITOR_TYPE_LABEL[row.type]}
                  </span>
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.keyword} className="p-1 text-center">
                    <span
                      className={`inline-block w-full rounded py-1 text-xs ${STATE_CLASS[cell.state]}`}
                      title={cellTitle(cell.keyword, cell.position, cell.aiCitationRate, cell.state)}
                    >
                      {STATE_MARK[cell.state]}
                      <span className="sr-only">{COVERAGE_LABEL[cell.state]}</span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(['covered', 'weak', 'absent', 'not_measured'] as CoverageState[]).map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`inline-block rounded px-2 py-0.5 ${STATE_CLASS[s]}`}>{STATE_MARK[s]}</span>
            {COVERAGE_LABEL[s]}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MatrixTable;
