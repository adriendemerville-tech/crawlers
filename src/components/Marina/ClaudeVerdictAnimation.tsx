import { useEffect, useRef, useState } from 'react';
import claudeLogo from '@/assets/claude-logo-64.png.asset.json';

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
    <div ref={ref} className="mx-auto w-full max-w-[min(1600px,92vw)] px-4">
      <div className="overflow-hidden rounded-2xl border border-[#e3e1d7] bg-[#faf9f5] shadow-sm dark:border-[#3a3a37] dark:bg-[#262624]">
        {/* Barre de fenêtre */}
        <div className="flex items-center gap-2 border-b border-[#e3e1d7] px-4 py-3 dark:border-[#3a3a37]">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" aria-hidden />
          <p className="ml-3 truncate text-[13px] text-[#73726c] dark:text-[#a3a29c]">
            Capacité à reproduire un audit SEO GEO — conversation Claude
          </p>
        </div>

        <div className="space-y-6 px-5 py-6 sm:px-8 sm:py-8">
          {/* Question utilisateur */}
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-2xl bg-[#f0eee6] px-4 py-3 text-[15px] leading-[1.6] text-[#141413] dark:bg-[#30302e] dark:text-[#f5f4ef]">
              {phase === 'idle' ? QUESTION : typed}
              {phase === 'typing' && <span className="ml-0.5 animate-pulse">|</span>}
            </p>
          </div>

          {/* Réponse */}
          <div className={showVerdict || phase === 'thinking' ? 'animate-fade-in' : 'opacity-0'}>
            <p className="mb-3 flex items-center gap-2 text-[13px] text-[#63625c] dark:text-[#a8a7a0]">
              <img
                src={claudeLogo.url}
                alt="Logo Claude"
                width={16}
                height={16}
                loading="lazy"
                decoding="async"
                className={`h-4 w-4 shrink-0 ${
                  phase === 'thinking'
                    ? 'animate-[pulse_0.7s_ease-in-out_infinite]'
                    : 'animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]'
                }`}
              />
              {phase === 'thinking' ? 'A réfléchi pendant 20 s…' : 'A réfléchi pendant 20 s'}
            </p>
            {showVerdict && (
              <p className="mb-4 text-left text-[22px] font-semibold tracking-[-0.01em] text-[#141413] dark:text-[#f5f4ef]">
                Non.
              </p>
            )}
            <blockquote className="citable-passage text-left text-[16px] leading-[1.7] text-[#141413] dark:text-[#e8e6e1]">
              {phase === 'answer'
                ? ANSWER.slice(0, answerLen)
                : phase === 'idle'
                  ? ANSWER
                  : ''}
              {phase !== 'answer' && showVerdict && <span className="animate-pulse">|</span>}
            </blockquote>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Verdict obtenu en soumettant un rapport Marina réel à Claude (Sonnet), août 2026.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClaudeVerdictAnimation;
