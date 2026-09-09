import { useEffect, useRef, useState } from 'react';
import claudeLogo from '@/assets/claude-logo-64.webp.asset.json';

/**
 * Reproduction typographique d'une session d'agent (type Claude Code) appelant
 * le serveur MCP Crawlers : connexion, appel d'outil, constats, correction,
 * re-mesure. Le texte complet est présent dans le DOM au rendu serveur (donc
 * lisible par les crawleurs et les moteurs génératifs) ; l'animation ne fait
 * que le révéler progressivement à l'entrée dans le viewport.
 */

export type McpStep =
  | { kind: 'user'; text: string }
  | { kind: 'tool'; name: string; args: string }
  | { kind: 'result'; lines: string[] }
  | { kind: 'assistant'; text: string };

interface Props {
  windowTitle: string;
  steps: McpStep[];
  caption: string;
}

const STEP_DELAY = 900;

export function McpSessionAnimation({ windowTitle, steps, caption }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<number>(-1); // -1 = SSR : tout affiché

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(steps.length);
      return;
    }
    const start = () => setVisible(0);
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
  }, [steps.length]);

  useEffect(() => {
    if (visible < 0 || visible >= steps.length) return;
    const id = window.setTimeout(() => setVisible((v) => v + 1), STEP_DELAY);
    return () => window.clearTimeout(id);
  }, [visible, steps.length]);

  const shown = (i: number) => visible < 0 || i < visible;
  const running = visible >= 0 && visible < steps.length;

  return (
    <div ref={ref} className="not-prose my-10 w-full">
      <div className="overflow-hidden rounded-2xl border border-[#e3e1d7] bg-[#faf9f5] shadow-sm dark:border-[#3a3a37] dark:bg-[#262624]">
        {/* Barre de fenêtre */}
        <div className="flex items-center gap-2 border-b border-[#e3e1d7] px-4 py-3 dark:border-[#3a3a37]">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" aria-hidden />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" aria-hidden />
          <p className="ml-3 truncate text-[13px] text-[#73726c] dark:text-[#a3a29c]">{windowTitle}</p>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-8 sm:py-8">
          {steps.map((step, i) => {
            const cls = shown(i) ? 'animate-fade-in' : 'opacity-0';

            if (step.kind === 'user') {
              return (
                <div key={i} className={`flex justify-end ${cls}`}>
                  <p className="max-w-[85%] rounded-2xl bg-[#f0eee6] px-4 py-3 text-[15px] leading-[1.6] text-[#141413] dark:bg-[#30302e] dark:text-[#f5f4ef]">
                    {step.text}
                  </p>
                </div>
              );
            }

            if (step.kind === 'tool') {
              return (
                <div
                  key={i}
                  className={`rounded-xl border border-[#e3e1d7] bg-[#f0eee6]/60 px-4 py-3 dark:border-[#3a3a37] dark:bg-[#30302e]/60 ${cls}`}
                >
                  <p className="flex flex-wrap items-center gap-2 text-[12px] uppercase tracking-wide text-[#73726c] dark:text-[#a3a29c]">
                    <span className="rounded border border-primary/40 px-1.5 py-0.5 text-[11px] normal-case text-primary">
                      crawlers · mcp
                    </span>
                    <span className="font-mono text-[13px] normal-case tracking-normal text-[#141413] dark:text-[#f5f4ef]">
                      {step.name}
                    </span>
                  </p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12.5px] leading-[1.6] text-[#63625c] dark:text-[#c9c8c2]">
                    {step.args}
                  </pre>
                </div>
              );
            }

            if (step.kind === 'result') {
              return (
                <div key={i} className={cls}>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words border-l-2 border-primary/40 pl-4 font-mono text-[12.5px] leading-[1.7] text-[#141413] dark:text-[#e8e6e1]">
                    {step.lines.join('\n')}
                  </pre>
                </div>
              );
            }

            return (
              <div key={i} className={cls}>
                <p className="mb-2 flex items-center gap-2 text-[13px] text-[#63625c] dark:text-[#a8a7a0]">
                  <img
                    src={claudeLogo.url}
                    alt=""
                    width={16}
                    height={16}
                    loading="lazy"
                    decoding="async"
                    aria-hidden
                    className={`h-4 w-4 shrink-0 ${
                      running
                        ? 'animate-[pulse_0.7s_ease-in-out_infinite]'
                        : 'animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]'
                    }`}
                  />
                  agent
                </p>
                <p className="text-[15px] leading-[1.7] text-[#141413] dark:text-[#e8e6e1]">{step.text}</p>
              </div>
            );
          })}

          <p className="pt-2 text-center text-xs text-muted-foreground">{caption}</p>
        </div>
      </div>
    </div>
  );
}

export default McpSessionAnimation;
