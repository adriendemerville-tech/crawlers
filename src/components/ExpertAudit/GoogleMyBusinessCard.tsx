import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Star, Clock, MessageSquare, Lightbulb } from 'lucide-react';
import { GoogleMyBusinessData } from '@/types/expertAudit';
import { useLanguage } from '@/contexts/LanguageContext';

const translations = {
  fr: {
    avgRating: 'Note moyenne',
    googleReviews: 'Avis Google',
    category: 'Catégorie',
    claimed: 'Fiche revendiquée',
    yes: 'Oui',
    no: 'Non',
    detected: 'Fiche détectée',
    quickWins: 'Quick Wins',
  },
  en: {
    avgRating: 'Average rating',
    googleReviews: 'Google Reviews',
    category: 'Category',
    claimed: 'Claimed listing',
    yes: 'Yes',
    no: 'No',
    detected: 'Listing detected',
    quickWins: 'Quick Wins',
  },
  es: {
    avgRating: 'Calificación media',
    googleReviews: 'Reseñas Google',
    category: 'Categoría',
    claimed: 'Ficha reclamada',
    yes: 'Sí',
    no: 'No',
    detected: 'Ficha detectada',
    quickWins: 'Quick Wins',
  },
};

interface Props {
  data: GoogleMyBusinessData;
}

function ratingColor(rating: number): string {
  if (rating >= 4.5) return 'text-emerald-600 dark:text-emerald-400';
  if (rating >= 4.0) return 'text-primary';
  if (rating >= 3.0) return 'text-warning';
  return 'text-destructive';
}

export function GoogleMyBusinessCard({ data }: Props) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  const kpis: { icon: React.ReactNode; label: string; value: string | number; sub?: string }[] = [];

  if (data.rating != null) {
    kpis.push({
      icon: <Star className="h-4 w-4" />,
      label: t.avgRating,
      value: (data.rating ?? 0).toFixed(1),
      sub: '/ 5',
    });
  }
  if (data.reviews_count != null) {
    kpis.push({
      icon: <MessageSquare className="h-4 w-4" />,
      label: t.googleReviews,
      value: data.reviews_count.toLocaleString(),
    });
  }
  if (data.category) {
    kpis.push({
      icon: <MapPin className="h-4 w-4" />,
      label: t.category,
      value: data.category,
    });
  }
  if (data.is_claimed != null) {
    kpis.push({
      icon: <Clock className="h-4 w-4" />,
      label: t.claimed,
      value: data.is_claimed ? t.yes : t.no,
    });
  }

  const displayKpis = kpis.slice(0, 4);

  return (
    <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <MapPin className="h-4.5 w-4.5 text-primary" />
          </div>
          Google My Business
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            {t.detected}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.title && (
          <p className="text-sm font-medium text-foreground">{data.title}</p>
        )}

        <div className={`grid gap-3 ${displayKpis.length > 2 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
          {displayKpis.map((kpi, i) => (
            <div key={i} className="rounded-lg bg-muted/50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {kpi.icon}
                <span className="text-[11px] uppercase tracking-wider">{kpi.label}</span>
              </div>
              <p className={`text-xl font-bold ${kpi.label === t.avgRating && data.rating ? ratingColor(data.rating) : 'text-foreground'}`}>
                {kpi.value}
                {kpi.sub && <span className="text-sm font-normal text-muted-foreground ml-0.5">{kpi.sub}</span>}
              </p>
            </div>
          ))}
        </div>

        {data.address && (
          <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3">
            {data.address}
          </p>
        )}

        {data.quick_wins && data.quick_wins.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              {t.quickWins}
            </p>
            <ul className="space-y-1.5">
              {data.quick_wins.slice(0, 2).map((win, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {win}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
