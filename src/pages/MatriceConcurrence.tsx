import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Header } from '@/components/Header';
import { Link } from '@/lib/router-compat';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { MatrixReportView } from '@/components/CompetitorMatrix/MatrixReportView';
import {
  advanceCompetitorMatrix, getCompetitorMatrixQuota,
  saveCompetitorMatrixLead, startCompetitorMatrix,
} from '@/lib/competitorMatrix/matrix.functions';
import { STEP_LABEL, type MatrixJobState } from '@/lib/competitorMatrix/types';


const Footer = lazy(() => import('@/components/Footer').then((m) => ({ default: m.Footer })));

export const MATRIX_FAQS: { q: string; a: string }[] = [
  {
    q: 'Qui sont vraiment mes concurrents ?',
    a: "Trois familles cohabitent et l'outil les distingue. Le concurrent métier vend le même produit ou le même service sur le même marché, qu'il soit visible ou non. Le concurrent de visibilité occupe la SERP et les réponses d'IA sur vos requêtes sans forcément proposer la même offre. Le concurrent silencieux propose la même offre mais n'apparaît nulle part : il ne vous prend pas de trafic aujourd'hui, il vous prend des clients hors ligne. Les substituts fonctionnels et les grandes plateformes dominantes sont listés à part, car ils faussent la lecture d'une matrice de mots-clés.",
  },
  {
    q: 'Comment la citation dans ChatGPT, Gemini et Claude est-elle mesurée ?',
    a: "Chaque mot-clé est posé 3 fois à chaque moteur (ChatGPT, Gemini, Claude), soit 9 réponses par mot-clé. L'outil compte dans combien de ces réponses chaque domaine est cité, et affiche un taux, pas un tirage unique. Exemple pour le mot-clé « meilleur outil marketing référencement » : itération 1 — ChatGPT cite concurrentA.fr, Gemini cite concurrentB.fr, Claude ne cite personne ; itération 2 — ChatGPT cite concurrentA.fr, Gemini ne cite personne, Claude cite votre-site.fr ; itération 3 — ChatGPT ne cite personne, Gemini cite concurrentB.fr, Claude cite votre-site.fr. Votre domaine est cité 2 fois sur 9 : taux de citation IA ≈ 22 %. Une marque citée une seule fois n'est pas une marque visible : la répétition sépare la citation stable du hasard.",
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

  const [unlimited, setUnlimited] = useState(false);

  useEffect(() => {
    getCompetitorMatrixQuota()
      .then((q) => {
        setRemaining(q.remaining);
        setUnlimited(Boolean((q as { unlimited?: boolean }).unlimited));
      })
      .catch(() => setRemaining(null));
  }, []);


  // Chaque appel exécute une étape courte ; on relance tant que l'analyse tourne.
  // Un appel réseau qui échoue (coupure, étape trop longue) est réessayé :
  // le job reste valide en base, seule la requête a échoué.
  const failures = useRef(0);
  useEffect(() => {
    if (!job || job.status !== 'running') return;
    let cancelled = false;
    const delay = failures.current > 0 ? Math.min(8000, 1500 * failures.current) : 600;
    const timer = setTimeout(async () => {
      try {
        const res = await advanceCompetitorMatrix({ data: { jobId: job.id } });
        if (cancelled) return;
        failures.current = 0;
        if ('error' in res) setError(res.message ?? 'Erreur inattendue.');
        else setJob(res.job);
      } catch {
        if (cancelled) return;
        failures.current += 1;
        if (failures.current >= 5) {
          setError('Analyse interrompue. Réessayez dans quelques minutes.');
          return;
        }
        setJob({ ...job }); // relance une tentative après backoff
      }
    }, delay);
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
            <strong>AI Overviews</strong> et taux de citation dans <strong>ChatGPT, Gemini et
            Claude</strong> sur trois itérations par moteur. Gratuit, une matrice par jour.
          </p>
        </header>

        <Card className="mb-10">
          <CardContent className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">URL de votre entreprise</span>
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
              <Button onClick={launch} disabled={running || !url.trim() || (!unlimited && remaining === 0)}>
                {running ? 'Analyse en cours…' : 'Générer ma matrice'}
              </Button>
              {unlimited ? (
                <span className="text-sm text-muted-foreground">Usage illimité (admin)</span>
              ) : remaining !== null && (
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
            <section className="space-y-12">
              <MatrixReportView job={job} />


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
