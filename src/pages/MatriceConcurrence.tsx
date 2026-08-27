import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { MatrixTable } from '@/components/CompetitorMatrix/MatrixTable';
import {
  advanceCompetitorMatrix, getCompetitorMatrixQuota,
  saveCompetitorMatrixLead, startCompetitorMatrix,
} from '@/lib/competitorMatrix/matrix.functions';
import { COMPETITOR_TYPE_LABEL, STEP_LABEL, type MatrixJobState } from '@/lib/competitorMatrix/types';

const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

export const MATRIX_FAQS: { q: string; a: string }[] = [
  {
    q: 'Qui sont vraiment mes concurrents ?',
    a: "Trois familles cohabitent et l'outil les distingue. Le concurrent métier vend le même produit ou le même service sur le même marché, qu'il soit visible ou non. Le concurrent de visibilité occupe la SERP et les réponses d'IA sur vos requêtes sans forcément proposer la même offre. Le concurrent silencieux propose la même offre mais n'apparaît nulle part : il ne vous prend pas de trafic aujourd'hui, il vous prend des clients hors ligne. Les substituts fonctionnels et les grandes plateformes dominantes sont listés à part, car ils faussent la lecture d'une matrice de mots-clés.",
  },
  {
    q: 'Comment la citation dans ChatGPT et Gemini est-elle mesurée ?',
    a: "Chaque mot-clé retenu est posé trois fois à Gemini et trois fois à ChatGPT, soit six réponses. L'outil compte dans combien de ces réponses chaque domaine est cité, et affiche un taux, pas un tirage unique. Une marque citée une fois sur six n'est pas une marque visible : la répétition sépare la citation stable du hasard.",
  },
  {
    q: 'Que signifie la ligne AI Overviews position 0 ?',
    a: "Pour chaque mot-clé, l'outil relève si Google déclenche un AI Overview et quels domaines y sont cités comme sources. Ces domaines captent la réponse avant tout clic organique. Un mot-clé où un AI Overview se déclenche sans vous citer est une perte de visibilité qui n'apparaît dans aucun suivi de position classique.",
  },
  {
    q: 'Pourquoi certaines cases affichent « non mesuré » ?',
    a: "Parce qu'une donnée manquante n'est pas une absence. La mesure de citation IA porte sur les dix mots-clés à plus forte valeur, pour garder l'outil gratuit. Les autres cases restent explicitement non mesurées plutôt que d'être comptées comme un échec.",
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export default function MatriceConcurrence() {
  useCanonicalHreflang('/matrice-concurrence');

  const [url, setUrl] = useState('');
  const [rivals, setRivals] = useState('');
  const [job, setJob] = useState<MatrixJobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [leadSaved, setLeadSaved] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCompetitorMatrixQuota()
      .then((q) => setRemaining(q.remaining))
      .catch(() => setRemaining(null));
  }, []);

  // Chaque appel exécute une étape courte ; on relance tant que l'analyse tourne.
  useEffect(() => {
    if (!job || job.status !== 'running') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await advanceCompetitorMatrix({ data: { jobId: job.id } });
        if (cancelled) return;
        if ('error' in res) setError(res.message ?? 'Erreur inattendue.');
        else setJob(res.job);
      } catch {
        if (!cancelled) setError('Analyse interrompue. Réessayez dans quelques minutes.');
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [job]);

  useEffect(() => {
    if (job?.status === 'done') resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [job?.status]);

  const launch = useCallback(async () => {
    setError(null);
    setLeadSaved(false);
    const competitors = rivals.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3);
    try {
      const res = await startCompetitorMatrix({ data: { url, competitors } });
      if ('error' in res) { setError(res.message ?? 'Erreur inattendue.'); return; }
      setJob(res.job);
      setRemaining((r) => (r === null ? r : Math.max(0, r - 1)));
    } catch {
      setError('Impossible de démarrer l’analyse.');
    }
  }, [url, rivals]);

  const submitLead = useCallback(async () => {
    if (!job) return;
    setLeadError(null);
    if (!EMAIL_RE.test(email)) { setLeadError('Adresse email invalide'); return; }
    const res = await saveCompetitorMatrixLead({ data: { jobId: job.id, email, consent: true } });
    if ('error' in res) setLeadError(res.message ?? 'Erreur inattendue.');
    else setLeadSaved(true);
  }, [job, email]);

  const running = job?.status === 'running';
  const summary = job?.matrix?.summary;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <header className="mb-10 max-w-3xl">
          <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
            Matrice de concurrence : les mots-clés que vos concurrents captent, dans Google et dans les IA
          </h1>
          <p className="text-lg text-muted-foreground">
            Entrez une adresse. L’outil identifie vos concurrents <strong>métier</strong>, de{' '}
            <strong>visibilité</strong> et <strong>silencieux</strong>, retient les 20 requêtes qui structurent
            votre marché, puis mesure qui les couvre — position Google, sources citées par les{' '}
            <strong>AI Overviews</strong> et taux de citation dans <strong>ChatGPT et Gemini</strong> sur trois
            itérations par moteur. Gratuit, une matrice par jour.
          </p>
        </header>

        <Card className="mb-10">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Adresse de votre entreprise</span>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="exemple.fr"
                  inputMode="url"
                  disabled={running}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Concurrents connus (optionnel, 3 max)</span>
                <Input
                  value={rivals}
                  onChange={(e) => setRivals(e.target.value)}
                  placeholder="concurrent1.fr, concurrent2.fr"
                  disabled={running}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={launch} disabled={running || !url.trim() || remaining === 0}>
                {running ? 'Analyse en cours…' : 'Générer ma matrice'}
              </Button>
              {remaining !== null && (
                <span className="text-sm text-muted-foreground">
                  {remaining > 0 ? `${remaining} matrice gratuite disponible aujourd’hui` : 'Quota du jour atteint'}
                </span>
              )}
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            {running && job && (
              <div className="space-y-2" aria-live="polite">
                <div className="h-2 w-full overflow-hidden rounded bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${job.progress}%` }} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {STEP_LABEL[job.step]} — {job.progress} %
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div ref={resultRef}>
          {job?.status === 'done' && job.matrix && (
            <section className="space-y-8">
              <h2 className="text-2xl font-bold">Votre matrice de concurrence</h2>

              <MatrixTable matrix={job.matrix} keywords={job.keywords} />

              {summary && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="mb-2 font-semibold">Ce que vous couvrez</h3>
                      <p className="text-sm text-muted-foreground">
                        <strong>{summary.covered.length}</strong> mots-clés bien couverts,{' '}
                        <strong>{summary.weak.length}</strong> en couverture faible,{' '}
                        <strong>{summary.missing.length}</strong> absents.
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="mb-2 font-semibold">Terrain libre</h3>
                      <p className="text-sm text-muted-foreground">
                        {summary.noMansLand.length > 0
                          ? `${summary.noMansLand.length} requêtes que personne ne couvre : ${summary.noMansLand.slice(0, 3).join(', ')}.`
                          : 'Aucune requête totalement inoccupée sur ce marché.'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="mb-2 font-semibold">Sources des AI Overviews</h3>
                      <p className="text-sm text-muted-foreground">
                        {summary.aiOverviewLeaders.length > 0
                          ? summary.aiOverviewLeaders.slice(0, 4).map((l) => `${l.domain} (${l.count})`).join(', ')
                          : 'Aucun AI Overview relevé sur ces requêtes.'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {job.matrix.outOfScope.length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <h3 className="mb-2 font-semibold">Hors matrice : substituts et plateformes dominantes</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {job.matrix.outOfScope.map((c) => (
                        <li key={c.domain}>
                          <strong>{c.name}</strong> — {COMPETITOR_TYPE_LABEL[c.type]}. {c.reason}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="space-y-3 p-5">
                  <h3 className="font-semibold">Recevoir cette matrice par email</h3>
                  {leadSaved ? (
                    <p className="text-sm text-muted-foreground">
                      Envoyé. Votre lien de partage :{' '}
                      <code className="break-all">https://crawlers.fr/matrice-concurrence?r={job.shareToken}</code>
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@entreprise.fr"
                        className="max-w-xs"
                      />
                      <Button onClick={submitLead}>Recevoir la matrice</Button>
                      <span className="text-xs text-muted-foreground">
                        Aucune revente de données. Désinscription à tout moment.
                      </span>
                    </div>
                  )}
                  {leadError && <p role="alert" className="text-sm text-destructive">{leadError}</p>}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">
                    La matrice montre où vous êtes absent. L’<Link to="/audit-geo" className="underline">audit GEO complet</Link>{' '}
                    explique pourquoi : texte réellement servi aux robots, nœud d’identité JSON-LD, politique robots IA,
                    passages citables. <Link to="/marina" className="underline">Lancer un audit Marina</Link>.
                  </p>
                </CardContent>
              </Card>
            </section>
          )}
        </div>

        <section className="mt-16 max-w-3xl">
          <h2 className="mb-6 text-2xl font-bold">Questions fréquentes</h2>
          <div className="space-y-4">
            {MATRIX_FAQS.map((faq) => (
              <details key={faq.q} className="rounded-lg border border-border p-4">
                <summary className="cursor-pointer font-medium">{faq.q}</summary>
                <p className="mt-3 text-sm text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
