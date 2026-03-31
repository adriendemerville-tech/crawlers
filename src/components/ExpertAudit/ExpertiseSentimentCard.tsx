import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, GraduationCap, Lightbulb, CheckCircle2, XCircle, Badge } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ExpertiseSentiment } from '@/types/newAuditMetrics';

interface ExpertiseSentimentCardProps {
  data: ExpertiseSentiment;
}

export function ExpertiseSentimentCard({ data }: ExpertiseSentimentCardProps) {
  const labels = ['', 'Générique / IA', 'Peu incarné', 'Modéré', 'Expérimenté', 'Expert de terrain'];
  const sp = data.social_proof;

  return (
    <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <GraduationCap className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span>Sentiment d'Expertise (E-E-A-T Tone)</span>
            <span className="text-[11px] font-normal text-muted-foreground">(estimation partielle réalisée sur une seule page)</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 5-star rating */}
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-6 w-6 ${star <= data.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30'}`}
              />
            ))}
          </div>
          <span className="text-sm font-medium text-foreground">{labels[data.rating] || ''}</span>
        </div>

        {/* Justification */}
        <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3 italic">
          {data.justification}
        </p>

        {/* Social Proof Signals */}
        {sp && (
          <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Preuves sociales détectées</p>
            <div className="space-y-1.5">
              {[
                { label: 'Témoignages / études de cas', value: sp.has_testimonials },
                { label: 'Avis clients', value: sp.has_reviews },
                { label: 'Liens vers des réalisations concrètes', value: sp.has_portfolio_links },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  {item.value 
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> 
                    : <XCircle className="h-4 w-4 text-destructive/60 shrink-0" />
                  }
                  <span className={item.value ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                </div>
              ))}
            </div>
            {sp.details && (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{sp.details}</p>
            )}
          </div>
        )}

        {/* GBP Tip */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/50 border border-accent">
          <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-semibold">Astuce :</span> pour améliorer votre visibilité auprès des LLM, optimisez votre page Google Business à l'aide des outils Crawlers dans votre{' '}
            <Link to="/app/console?tab=gbp" className="text-primary underline underline-offset-2 hover:text-primary/80 font-medium">
              Console
            </Link>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
