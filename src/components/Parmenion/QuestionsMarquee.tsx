import { memo } from 'react';
import { Search } from 'lucide-react';

const QUESTIONS = [
  'plombier ouvert le dimanche à Lyon',
  'meilleur restaurant italien près de moi',
  'dentiste qui prend de nouveaux patients',
  'devis rénovation salle de bain Nantes',
  'coiffeur sans rendez-vous centre-ville',
  'garage auto fiable pas cher',
  'comptable pour micro-entreprise',
  'ostéopathe remboursé mutuelle',
];

/**
 * Bulles de recherche flottantes : les questions que les clients posent déjà aux IA.
 * Purement illustratif, sans réseau ni crédit. Animation désactivée en motion-reduce.
 */
function QuestionsMarqueeComponent(): React.ReactElement {
  const row = [...QUESTIONS, ...QUESTIONS];
  return (
    <div className="space-y-4 overflow-hidden" aria-label="Exemples de questions posées aux IA">
      {[0, 1].map((rowIndex) => (
        <div
          key={rowIndex}
          className="flex w-max gap-4"
          style={{
            animation: `questions-marquee ${rowIndex === 0 ? '42s' : '55s'} linear infinite`,
            animationDirection: rowIndex === 1 ? 'reverse' : 'normal',
          }}
        >
          {row.slice(rowIndex * 4, rowIndex * 4 + QUESTIONS.length).map((q, i) => (
            <div
              key={`${rowIndex}-${i}`}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm text-muted-foreground shadow-sm"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-brand-violet" />
              {q}
            </div>
          ))}
        </div>
      ))}
      <style>{`
        @keyframes questions-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="questions-marquee"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

export default memo(QuestionsMarqueeComponent);
