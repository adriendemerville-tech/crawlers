import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, GraduationCap, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ExpertiseSentiment } from '@/types/newAuditMetrics';

interface ExpertiseSentimentCardProps {
  data: ExpertiseSentiment;
}

export function ExpertiseSentimentCard({ data }: ExpertiseSentimentCardProps) {
  const labels = ['', 'Générique / IA', 'Peu incarné', 'Modéré', 'Expérimenté', 'Expert de terrain'];

  return (
    <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <GraduationCap className="h-4.5 w-4.5 text-primary" />
          </div>
          Sentiment d'Expertise (E-E-A-T Tone)
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
