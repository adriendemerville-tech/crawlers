import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

type Q = { id: string; label: string; hint: string; weight: number };

const QUESTIONS: Q[] = [
  { id: 'author', label: 'Vos pages clés ont-elles une page auteur avec biographie et JSON-LD Person ?', hint: 'Signal Expérience + Expertise', weight: 20 },
  { id: 'sources', label: 'Vos contenus citent-ils des sources externes vérifiables (études, données, liens) ?', hint: 'Signal Trust + Expertise', weight: 18 },
  { id: 'press', label: 'Avez-vous des mentions presse ou backlinks de sites reconnus dans votre secteur ?', hint: 'Signal Authoritativeness', weight: 22 },
  { id: 'legal', label: 'Mentions légales, page contact, HTTPS et politique de confidentialité sont-ils en place ?', hint: 'Signal Trustworthiness technique', weight: 15 },
  { id: 'history', label: 'Publiez-vous régulièrement avec des dates de mise à jour visibles sur les contenus ?', hint: 'Signal Expérience + fraîcheur', weight: 12 },
  { id: 'geo', label: 'Mesurez-vous votre citabilité par ChatGPT, Claude, Perplexity ou Google AI Overviews ?', hint: 'Signal GEO 2026', weight: 13 },
];

export function QuickEEATTest() {
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({});
  const [submitted, setSubmitted] = useState(false);

  const { score, level, color } = useMemo(() => {
    const total = QUESTIONS.reduce((s, q) => s + (answers[q.id] ? q.weight : 0), 0);
    let level = 'À risque';
    let color = 'text-destructive';
    if (total >= 75) { level = 'Solide'; color = 'text-amber-500'; }
    else if (total >= 45) { level = 'Moyen'; color = 'text-foreground'; }
    return { score: total, level, color };
  }, [answers]);

  const answered = Object.values(answers).filter(v => v !== undefined).length;
  const canSubmit = answered === QUESTIONS.length;

  return (
    <section className="py-10 sm:py-14 px-4 border-b border-border/50 bg-gradient-to-b from-primary/5 via-amber-500/5 to-background">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 mb-3 justify-center">
          <Badge variant="outline" className="text-xs uppercase gap-1">
            <Sparkles className="h-3 w-3" /> Lead magnet
          </Badge>
          <Badge variant="outline" className="text-xs">2 minutes · gratuit · sans inscription</Badge>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-center text-foreground mb-3">
          Test E-E-A-T rapide : où en est votre site en 2 minutes ?
        </h2>
        <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
          6 questions clés issues des Search Quality Rater Guidelines. Obtenez un score indicatif,
          puis lancez l'audit E-E-A-T complet sur Crawlers.fr pour le plan d'action priorisé.
        </p>

        <Card className="border-2 border-border/60">
          <CardContent className="p-5 sm:p-7">
            {!submitted ? (
              <>
                <div className="space-y-4">
                  {QUESTIONS.map((q, idx) => (
                    <div key={q.id} className="pb-4 border-b border-border/40 last:border-0 last:pb-0">
                      <div className="flex items-start gap-3 mb-2">
                        <span className="text-xs font-mono text-muted-foreground mt-1 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                        <div className="flex-1">
                          <p className="text-sm sm:text-base text-foreground font-medium">{q.label}</p>
                          <p className="text-xs text-muted-foreground mt-1">{q.hint}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-9">
                        <button
                          type="button"
                          onClick={() => setAnswers(a => ({ ...a, [q.id]: true }))}
                          className={`px-4 py-1.5 text-sm rounded-md border-2 transition-colors ${
                            answers[q.id] === true
                              ? 'border-amber-500 text-amber-500'
                              : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                          }`}
                        >
                          Oui
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnswers(a => ({ ...a, [q.id]: false }))}
                          className={`px-4 py-1.5 text-sm rounded-md border-2 transition-colors ${
                            answers[q.id] === false
                              ? 'border-destructive text-destructive'
                              : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                          }`}
                        >
                          Non
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {answered}/{QUESTIONS.length} réponses
                  </p>
                  <Button
                    size="lg"
                    disabled={!canSubmit}
                    onClick={() => setSubmitted(true)}
                    className="gap-2 w-full sm:w-auto border-2 border-foreground bg-transparent text-foreground hover:bg-foreground/5 disabled:opacity-40"
                  >
                    Voir mon score E-E-A-T
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Score E-E-A-T indicatif</p>
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className={`text-6xl font-bold ${color}`}>{score}</span>
                  <span className="text-2xl text-muted-foreground">/100</span>
                </div>
                <p className={`text-lg font-semibold mb-6 ${color}`}>Niveau : {level}</p>

                <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto mb-6 text-left">
                  {QUESTIONS.map(q => (
                    <div key={q.id} className="flex items-start gap-2 text-sm">
                      {answers[q.id] ? (
                        <CheckCircle2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      )}
                      <span className={answers[q.id] ? 'text-foreground' : 'text-muted-foreground'}>
                        {q.hint}
                      </span>
                    </div>
                  ))}
                </div>

                <blockquote className="citable-passage border-l-4 border-amber-500 bg-amber-500/5 px-5 py-4 rounded-r-lg mb-6 text-left text-sm text-foreground">
                  Ce score est indicatif. L'audit E-E-A-T complet de Crawlers.fr analyse plus de 80 signaux
                  (auteurs, sources, backlinks, technique, JSON-LD, citabilité IA) et génère un plan d'action
                  priorisé avec sévérité, prime de récence et tâches prêtes à exécuter.
                </blockquote>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to="/auth?mode=signup&source=eeat-quick-test">
                    <Button size="lg" className="gap-2 w-full sm:w-auto border-2 border-foreground bg-transparent text-foreground hover:bg-foreground/5">
                      Lancer l'audit E-E-A-T complet (gratuit)
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => { setAnswers({}); setSubmitted(false); }}
                    className="w-full sm:w-auto"
                  >
                    Refaire le test
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
