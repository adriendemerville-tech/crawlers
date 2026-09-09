import { useEffect, useRef, useState } from 'react';
import claudeLogo from '@/assets/claude-logo-64.webp.asset.json';

/**
 * Reproduction typographique d'une session d'agent (type Claude Code) appelant
 * le serveur MCP Crawlers : connexion, appel d'outil, résultats mis en forme
 * comme un dashboard, correction, re-mesure. Le texte complet est présent dans
 * le DOM au rendu serveur (donc lisible par les crawleurs et les moteurs
 * génératifs) ; l'animation ne fait que le révéler progressivement à l'entrée
 * dans le viewport.
 */

export type McpTone = 'good' | 'warn' | 'bad' | 'neutral';

export type McpStep =
  | { kind: 'user'; text: string }
  | { kind: 'connect'; text: string }
  | { kind: 'tool'; name: string; args: string }
  | { kind: 'result'; lines: string[] }
  | {
      kind: 'dashboard';
      title: string;
      metrics: { label: string; value: string; tone?: McpTone }[];
      rows?: { id: string; severity: 'high' | 'medium' | 'low'; label: string }[];
    }
  | { kind: 'assistant'; text: string };

interface Props {
  windowTitle: string;
  steps: McpStep[];
  caption: string;
}

const STEP_DELAY = 2000;
const THINKING_DELAY = 1200;

const toneClass: Record<McpTone, string> = {
  good: 'text-[#1a7f37] dark:text-[#4ac26b]',
  warn: 'text-[#b07d10] dark:text-[#e3b341]',
  bad: 'text-[#c93c37] dark:text-[#ff7b72]',
  neutral: 'text-[#141413] dark:text-[#f5f4ef]',
};

const severityClass: Record<'high' | 'medium' | 'low', string> = {
  high: 'border-[#c93c37]/50 text-[#c93c37] dark:text-[#ff7b72]',
  medium: 'border-[#b07d10]/50 text-[#b07d10] dark:text-[#e3b341]',
  low: 'border-[#73726c]/50 text-[#73726c] dark:text-[#a3a29c]',
};

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

  const assistantMark = (
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
  );

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

            if (step.kind === 'connect') {
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 ${cls}`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  <p className="font-mono text-[12.5px] leading-[1.6] text-[#141413] dark:text-[#e8e6e1]">
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

            if (step.kind === 'dashboard') {
              return (
                <div
                  key={i}
                  className={`rounded-xl border border-[#e3e1d7] bg-white/70 p-4 dark:border-[#3a3a37] dark:bg-[#1f1f1d]/70 ${cls}`}
                >
                  <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#73726c] dark:text-[#a3a29c]">
                    {step.title}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {step.metrics.map((m, j) => (
                      <div
                        key={j}
                        className="rounded-lg border border-[#e3e1d7] bg-[#faf9f5] px-3 py-2.5 dark:border-[#3a3a37] dark:bg-[#262624]"
                      >
                        <p className={`text-lg font-semibold leading-tight ${toneClass[m.tone ?? 'neutral']}`}>
                          {m.value}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-[#73726c] dark:text-[#a3a29c]">
                          {m.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  {step.rows && step.rows.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {step.rows.map((r, j) => (
                        <li
                          key={j}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e3e1d7] px-3 py-2 text-[12.5px] dark:border-[#3a3a37]"
                        >
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide ${severityClass[r.severity]}`}
                          >
                            {r.severity}
                          </span>
                          <span className="font-mono text-[12px] text-[#63625c] dark:text-[#c9c8c2]">{r.id}</span>
                          <span className="text-[#141413] dark:text-[#e8e6e1]">{r.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
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
                  {assistantMark}
                  claude
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
