import { memo, useEffect, useRef, useState } from 'react';

/**
 * Démonstration illustrative : simule une réponse de moteur génératif citant
 * un commerce local. Aucune donnée réelle, aucun appel réseau, aucun crédit.
 * Le contenu textuel est présent dans le DOM SSR ; seule l'apparition est animée.
 */

const QUESTION = 'quel plombier fiable près de Nantes centre ?';

const ANSWER: string[] = [
  'Trois établissements reviennent le plus souvent sur cette zone :',
];

const CITED = [
  { name: 'Votre entreprise', detail: 'Plomberie · Nantes centre', highlight: true },
  { name: 'Concurrent A', detail: 'Plomberie · Nantes sud', highlight: false },
  { name: 'Concurrent B', detail: 'Dépannage · Rezé', highlight: false },
];

const STEP_DELAY = 1600;
const THINKING_DELAY = 1400;

function AiAnswerDemoComponent(): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0); // 0 vide, 1 question, 2 réflexion, 3 réponse

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setStep(3);
      return;
    }
    let started = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        if (started || !entries.some((e) => e.isIntersecting)) return;
        started = true;
        observer.disconnect();
        timers.push(setTimeout(() => setStep(1), 300));
        timers.push(setTimeout(() => setStep(2), 300 + STEP_DELAY));
        timers.push(setTimeout(() => setStep(3), 300 + STEP_DELAY + THINKING_DELAY));
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div ref={ref} className="w-full">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            Moteur génératif — réponse simulée
          </span>
          <span className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-violet/50" />
            <span className="h-2 w-2 rounded-full bg-brand-gold/60" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          </span>
        </div>

        <div className="min-h-[16rem] space-y-4 p-4 sm:min-h-[18rem] sm:p-5">
          <div
            className={`flex justify-end transition-opacity duration-500 ${step >= 1 ? 'opacity-100' : 'opacity-0'}`}
          >
            <p className="max-w-[85%] rounded-lg rounded-br-sm border border-border px-3 py-2 text-sm">
              {QUESTION}
            </p>
          </div>

          {step === 2 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-violet" />
              analyse des sources en cours
            </div>
          )}

          <div
            className={`space-y-3 transition-opacity duration-700 ${step >= 3 ? 'opacity-100' : 'opacity-0'}`}
          >
            {ANSWER.map((line) => (
              <p key={line} className="text-sm text-muted-foreground">
                {line}
              </p>
            ))}
            <ul className="space-y-2">
              {CITED.map((c, i) => (
                <li
                  key={c.name}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
                    c.highlight
                      ? 'border-brand-violet/60 bg-brand-violet/5'
                      : 'border-border'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                      c.highlight
                        ? 'border-brand-violet text-brand-violet'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate font-medium ${c.highlight ? 'text-foreground' : ''}`}>
                      {c.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Illustration du résultat visé : être cité en tête sur les questions de votre zone. Ce n'est pas une mesure réelle.
      </p>
    </div>
  );
}

export default memo(AiAnswerDemoComponent);
