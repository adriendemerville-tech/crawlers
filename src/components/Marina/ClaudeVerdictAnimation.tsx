import { useEffect, useRef, useState } from 'react';

/**
 * Reproduction typographique (sans capture d'écran) d'un échange réel où
 * Claude reconnaît ne pas pouvoir produire un audit équivalent à Marina.
 * Animation déclenchée à l'entrée dans le viewport, texte réellement présent
 * dans le DOM (donc lisible par les crawlers et les moteurs génératifs).
 */

const QUESTION =
  "es-tu capable de faire mieux que cet audit SEO GEO ? réponds simplement oui ou non avec une courte explication, sans me faire de proposition.";

const ANSWER =
  "Cet audit s'appuie sur une infrastructure que je n'ai pas : un crawler dédié ayant exploré 150 pages avec mesures structurées (poids code/texte, alt manquants, maillage interne quantifié), l'accès à une base type DataForSEO pour les volumes de recherche, positions SERP réelles et profil de backlinks, et surtout des requêtes réelles envoyées à cinq moteurs distincts (ChatGPT, Gemini, Perplexity, Claude, Mistral) pour mesurer un taux de citation comparatif. Je ne peux ni crawler un site à cette échelle avec cette granularité, ni interroger d'autres IA que moi-même. Je n'égalerais pas la rigueur ni la couverture chiffrée de ce rapport.";

type Phase = 'idle' | 'typing' | 'thinking' | 'verdict' | 'answer';

export function ClaudeVerdictAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [typed, setTyped] = useState('');
  const [answerLen, setAnswerLen] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setPhase('typing');
      return;
    }
    const start = () => setPhase((p) => (p === 'idle' ? 'typing' : p));
    // Si la carte est déjà visible au montage, on démarre sans attendre l'observer.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      start();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          start();
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);


  useEffect(() => {
    if (phase !== 'typing') return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 5;
      setTyped(QUESTION.slice(0, i));
      if (i >= QUESTION.length) {
        window.clearInterval(id);
        window.setTimeout(() => setPhase('thinking'), 250);
      }
    }, 16);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'thinking') return;
    const id = window.setTimeout(() => setPhase('verdict'), 900);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'verdict') return;
    const id = window.setTimeout(() => setPhase('answer'), 700);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'answer') return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 12;
      setAnswerLen(i);
      if (i >= ANSWER.length) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [phase]);

  // 'idle' = état SSR : tout le texte est présent pour les crawlers.
  const showVerdict = phase === 'idle' || phase === 'verdict' || phase === 'answer';


  return (
    <div ref={ref} className="mx-auto max-w-3xl px-4">
      <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
        {/* Barre de fenêtre */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-destructive/70" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[hsl(var(--secondary))]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-primary/70" aria-hidden />
          <p className="ml-3 text-sm text-muted-foreground truncate">
            Capacité à reproduire un audit SEO GEO — conversation Claude
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Question utilisateur */}
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
              {phase === 'idle' ? QUESTION : typed}
              {phase === 'typing' && <span className="ml-0.5 animate-pulse">|</span>}
            </p>
          </div>

          {/* Réponse */}
          <div className={showVerdict ? 'animate-fade-in' : 'opacity-0'}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              {phase === 'thinking' ? 'A réfléchi pendant 20 s…' : 'A réfléchi pendant 20 s'}
            </p>
            {showVerdict && (
              <p className="text-3xl font-bold text-primary mb-3">Non.</p>
            )}
            <blockquote className="citable-passage border-l-4 border-primary bg-muted/30 pl-4 py-3 text-sm leading-relaxed text-foreground">
              {phase === 'answer'
                ? ANSWER.slice(0, answerLen)
                : phase === 'idle'
                  ? ANSWER
                  : ''}
              {phase !== 'answer' && showVerdict && <span className="animate-pulse">|</span>}
            </blockquote>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Verdict obtenu en soumettant un rapport Marina réel à Claude (Sonnet), août 2026.
      </p>
    </div>
  );
}

export default ClaudeVerdictAnimation;
