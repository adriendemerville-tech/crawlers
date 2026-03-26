import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, ArrowRight, Trophy, Loader2 } from 'lucide-react';

interface QuizQuestion {
  id: string;
  category: 'seo' | 'geo' | 'llm';
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: string[];
}

interface AnswerKey {
  [id: string]: { correct: number; explanation: string; feature_link?: string };
}

interface SeoQuizProps {
  questions: QuizQuestion[];
  answerKey: AnswerKey;
  onComplete: (score: number, total: number, wrongAnswers: { question: string; correct: string; explanation: string; feature_link?: string }[]) => void;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  seo: { label: 'SEO', color: 'bg-blue-500/15 text-blue-500' },
  geo: { label: 'GEO', color: 'bg-emerald-500/15 text-emerald-500' },
  llm: { label: 'LLM', color: 'bg-purple-500/15 text-purple-500' },
};

const DIFFICULTY_DOTS: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

export function SeoQuiz({ questions, answerKey, onComplete }: SeoQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<{ question: string; correct: string; explanation: string; feature_link?: string }[]>([]);

  const q = questions[currentIndex];
  if (!q) return null;

  const answer = answerKey[q.id];
  const isLast = currentIndex === questions.length - 1;
  const catInfo = CATEGORY_LABELS[q.category] || CATEGORY_LABELS.seo;
  const diffDots = DIFFICULTY_DOTS[q.difficulty] || 1;

  const handleSelect = (optionIdx: number) => {
    if (isRevealed) return;
    setSelectedAnswer(optionIdx);
    setIsRevealed(true);

    const isCorrect = optionIdx === answer?.correct;
    if (isCorrect) {
      setScore(s => s + 1);
    } else if (answer) {
      setWrongAnswers(prev => [...prev, {
        question: q.question,
        correct: q.options[answer.correct],
        explanation: answer.explanation,
        feature_link: answer.feature_link,
      }]);
    }
  };

  const handleNext = () => {
    if (isLast) {
      onComplete(score + (selectedAnswer === answer?.correct ? 0 : 0), questions.length, wrongAnswers);
      return;
    }
    setCurrentIndex(i => i + 1);
    setSelectedAnswer(null);
    setIsRevealed(false);
  };

  return (
    <div className="bg-muted/40 rounded-xl p-3 space-y-3 border border-border/50">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", catInfo.color)}>
            {catInfo.label}
          </span>
          <div className="flex gap-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cn("h-1.5 w-1.5 rounded-full", i < diffDots ? "bg-foreground/60" : "bg-foreground/15")} />
            ))}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">{currentIndex + 1}/{questions.length}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${((currentIndex + (isRevealed ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <p className="text-xs font-medium text-foreground leading-relaxed">{q.question}</p>

      {/* Options */}
      <div className="space-y-1.5">
        {q.options.map((opt, i) => {
          const isSelected = selectedAnswer === i;
          const isCorrect = answer?.correct === i;

          let borderClass = 'border-border/40 hover:border-primary/40 hover:bg-primary/5 cursor-pointer';
          if (isRevealed) {
            if (isCorrect) borderClass = 'border-emerald-500/50 bg-emerald-500/10';
            else if (isSelected && !isCorrect) borderClass = 'border-destructive/50 bg-destructive/10';
            else borderClass = 'border-border/20 opacity-50';
          }

          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={isRevealed}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg border text-xs transition-all flex items-center gap-2",
                borderClass
              )}
            >
              <span className="font-mono text-muted-foreground text-[10px] shrink-0">{String.fromCharCode(65 + i)}.</span>
              <span className="flex-1">{opt}</span>
              {isRevealed && isCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
              {isRevealed && isSelected && !isCorrect && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Explanation after reveal */}
      {isRevealed && answer && selectedAnswer !== answer.correct && (
        <div className="text-[11px] text-muted-foreground leading-relaxed bg-muted/60 rounded-lg p-2.5 border border-border/30">
          {answer.explanation}
        </div>
      )}

      {/* Next button */}
      {isRevealed && (
        <button
          onClick={handleNext}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          {isLast ? 'Voir mon score' : 'Question suivante'}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
