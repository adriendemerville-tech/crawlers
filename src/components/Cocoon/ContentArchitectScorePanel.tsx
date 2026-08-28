import { useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import { computeArticleScore } from '@/lib/contentArchitect/articleScore';

interface Props {
  result: any;
  pageType: string;
}

/** Jauge demi-cercle : violet (charte Crawlers) avec repli or si le score est bas. */
function Gauge({ score }: { score: number }) {
  const r = 52;
  const circumference = Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const color = score >= 80 ? 'hsl(265 85% 68%)' : score >= 60 ? 'hsl(45 90% 55%)' : 'hsl(0 70% 60%)';
  return (
    <div className="relative flex flex-col items-center pt-1">
      <svg width="140" height="82" viewBox="0 0 140 82">
        <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke="currentColor" className="text-white/10" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M 18 70 A 52 52 0 0 1 122 70"
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
        <text x="70" y="62" textAnchor="middle" className="fill-white font-bold" style={{ fontSize: 30 }}>{score}</text>
      </svg>
      <span className="text-[10px] text-white/35 -mt-2">/100</span>
    </div>
  );
}

export function ContentArchitectScorePanel({ result, pageType }: Props) {
  const data = useMemo(() => computeArticleScore(result, pageType), [result, pageType]);

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-center">
        <p className="text-[10px] text-white/25">Le score s'affiche après la génération du contenu</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <p className="text-[10px] text-white/40 uppercase tracking-wider">Score de l'article</p>

      <Gauge score={data.score} />

      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {data.checks.map(c => (
          <div key={c.key} className="flex items-start gap-1.5" title={c.hint}>
            <span
              className={`mt-0.5 w-3.5 h-3.5 shrink-0 rounded-full border flex items-center justify-center ${
                c.ok ? 'border-purple-400/60 text-purple-300' : 'border-white/15 text-white/25'
              }`}
            >
              {c.ok ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <Minus className="w-2.5 h-2.5 stroke-[3]" />}
            </span>
            <span className={`text-[11px] leading-tight ${c.ok ? 'text-white/70' : 'text-white/35'}`}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-white/10 space-y-1">
        {data.metrics.map(m => (
          <div key={m.label} className="flex items-center justify-between">
            <span className="text-[11px] text-white/45">{m.label}</span>
            <span className="text-[11px] font-medium text-white/80 bg-white/5 rounded px-1.5 py-0.5">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
