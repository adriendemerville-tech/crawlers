import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

/**
 * Instantané DataForSEO Labs des mots-clés positionnés d'un domaine.
 * Produit par `_shared/rankedKeywords.ts` (audit expert SEO + crawl).
 */
export interface RankedKeywordsSnapshot {
  domain: string;
  total_ranked_keywords: number;
  estimated_traffic: number;
  average_position: number;
  top3: number;
  top10: number;
  top_keywords: { keyword: string; position: number; volume: number; url: string }[];
  location_code?: number;
  language_code?: string;
  source?: string;
  fetched_at?: string;
}

type Props = {
  data?: RankedKeywordsSnapshot | null;
};

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

export function RankedKeywordsCard({ data }: Props) {
  if (!data || !data.total_ranked_keywords) return null;

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" />
          Mots-clés positionnés
          <Badge variant="outline" className="ml-auto text-xs">DataForSEO</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Mots-clés (top 100)</div>
            <div className="text-2xl font-semibold">{fmt(data.total_ranked_keywords)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Trafic estimé / mois</div>
            <div className="text-2xl font-semibold">{fmt(data.estimated_traffic)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Position moyenne</div>
            <div className="text-2xl font-semibold">{data.average_position || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Top 3 / Top 10</div>
            <div className="text-2xl font-semibold">{fmt(data.top3)} / {fmt(data.top10)}</div>
          </div>
        </div>

        {data.top_keywords?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Dix mots-clés au plus fort volume sur lesquels {data.domain} est positionné
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Mot-clé</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Position</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Volume / mois</th>
                  <th scope="col" className="py-2 font-medium">Page positionnée</th>
                </tr>
              </thead>
              <tbody>
                {data.top_keywords.slice(0, 10).map((kw) => (
                  <tr key={`${kw.keyword}-${kw.position}`} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3">{kw.keyword}</td>
                    <td className="py-2 pr-3 font-semibold">{kw.position <= 100 ? kw.position : '100+'}</td>
                    <td className="py-2 pr-3">{fmt(kw.volume)}</td>
                    <td className="max-w-[220px] truncate py-2 text-muted-foreground" title={kw.url}>
                      {kw.url ? new URL(kw.url).pathname : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Estimation DataForSEO sur la base Google France : les longues traînes peu recherchées ne sont pas comptées.
          À croiser avec Search Console pour le trafic réel.
        </p>
      </CardContent>
    </Card>
  );
}
