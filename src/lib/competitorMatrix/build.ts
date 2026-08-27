// Assemblage de la matrice et de la synthèse (pur, testable, isomorphe).
// Règle : un état `not_measured` n'est jamais converti en `absent`.

import type {
  AiReadingJson, Competitor, CoverageState, Identity, MarketKeyword,
  MatrixCell, MatrixResult, MatrixRow, MatrixSummary, SerpReadingJson,
} from './types';

export function cellState(position: number | null, rate: number | null, serpMeasured: boolean): CoverageState {
  if (position !== null && position <= 10) return 'covered';
  if (rate !== null && rate >= 0.5) return 'covered';
  if (position !== null && position <= 30) return 'weak';
  if (rate !== null && rate > 0) return 'weak';
  if (!serpMeasured && rate === null) return 'not_measured';
  return 'absent';
}

export function buildMatrix(
  identity: Identity,
  competitors: Competitor[],
  outOfScope: Competitor[],
  keywords: MarketKeyword[],
  serp: SerpReadingJson[],
  ai: AiReadingJson[],
): MatrixResult {
  const serpByKw = new Map(serp.map((s) => [s.keyword, s]));
  const aiByKw = new Map(ai.map((a) => [a.keyword, a]));

  const buildRow = (domain: string, name: string, type: MatrixRow['type']): MatrixRow => {
    const cells: MatrixCell[] = keywords.map((kw) => {
      const s = serpByKw.get(kw.keyword);
      const a = aiByKw.get(kw.keyword);
      const position = s ? (s.positions[domain] ?? null) : null;
      const rate = a && Object.keys(a.rates).length > 0 ? (a.rates[domain] ?? null) : null;
      return { keyword: kw.keyword, position, aiCitationRate: rate, state: cellState(position, rate, Boolean(s)) };
    });
    const inAiOverview = serp.some((s) => s.aiOverview.domains.includes(domain));
    return { domain, name, type, cells, inAiOverview };
  };

  const targetRow = buildRow(identity.domain, identity.name, 'target');
  const competitorRows = competitors.map((c) => buildRow(c.domain, c.name, c.type));

  return {
    rows: [targetRow, ...competitorRows],
    aiOverviewRow: serp.map((s) => s.aiOverview),
    outOfScope,
    summary: buildSummary(targetRow, competitorRows, keywords, serp, ai),
  };
}

function buildSummary(
  targetRow: MatrixRow,
  competitorRows: MatrixRow[],
  keywords: MarketKeyword[],
  serp: SerpReadingJson[],
  ai: AiReadingJson[],
): MatrixSummary {
  const covered: string[] = [];
  const weak: string[] = [];
  const missing: string[] = [];
  const noMansLand: string[] = [];

  keywords.forEach((kw, i) => {
    const cell = targetRow.cells[i];
    if (cell.state === 'covered') covered.push(kw.keyword);
    else if (cell.state === 'weak') weak.push(kw.keyword);
    else if (cell.state === 'absent') missing.push(kw.keyword);

    // « No man's land » : personne ne couvre, et la mesure a bien eu lieu.
    const rows = [targetRow, ...competitorRows];
    if (rows.length > 0 && rows.every((r) => r.cells[i].state === 'absent')) noMansLand.push(kw.keyword);
  });

  const lostAgainst = competitorRows
    .map((row) => ({
      domain: row.domain,
      count: row.cells.reduce((n, cell, i) => (
        cell.state === 'covered' && targetRow.cells[i].state !== 'covered' ? n + 1 : n
      ), 0),
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const leaderCount = new Map<string, number>();
  for (const s of serp) {
    for (const d of s.aiOverview.domains) leaderCount.set(d, (leaderCount.get(d) || 0) + 1);
  }
  const aiOverviewLeaders = [...leaderCount.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    covered, weak, missing, noMansLand, lostAgainst, aiOverviewLeaders,
    measuredKeywords: serp.length,
    aiMeasuredKeywords: ai.length,
  };
}
