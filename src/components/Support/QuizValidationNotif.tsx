import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingQuestion {
  id: string;
  difficulty: number;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface QuizValidationNotifProps {
  onDone: (message: string) => void;
}

export function QuizValidationNotif({ onDone }: QuizValidationNotifProps) {
  const [pending, setPending] = useState<PendingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ validated: 0, rejected: 0 });

  useEffect(() => {
    loadPending();
  }, []);

  async function loadPending() {
    setLoading(true);
    const { data } = await supabase
      .from('quiz_questions')
      .select('id, difficulty, question, options, correct_index, explanation')
      .eq('quiz_type', 'crawlers')
      .eq('is_active', false)
      .eq('auto_generated', true)
      .order('created_at', { ascending: false })
      .limit(20);

    setPending((data as PendingQuestion[]) || []);
    setLoading(false);
  }

  async function handleValidate(id: string) {
    setProcessing(true);
    await supabase
      .from('quiz_questions')
      .update({ is_active: true } as any)
      .eq('id', id);
    setStats(s => ({ ...s, validated: s.validated + 1 }));
    goNext();
  }

  async function handleReject(id: string) {
    setProcessing(true);
    await supabase
      .from('quiz_questions')
      .delete()
      .eq('id', id);
    setStats(s => ({ ...s, rejected: s.rejected + 1 }));
    goNext();
  }

  function goNext() {
    setProcessing(false);
    if (currentIdx + 1 >= pending.length) {
      onDone(`✅ Validation terminée — ${stats.validated + (currentIdx + 1 >= pending.length ? 1 : 0)} validées, ${stats.rejected} rejetées.`);
      return;
    }
    setCurrentIdx(i => i + 1);
  }

  if (loading) return <div className="text-[11px] text-muted-foreground animate-pulse p-2">Chargement des questions en attente...</div>;
  if (pending.length === 0) return null;

  const q = pending[currentIdx];
  if (!q) return null;

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-2">
      {/* Header */}
      <button onClick={() => setExpanded(e => !e)} className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            {pending.length - currentIdx} question{pending.length - currentIdx > 1 ? 's' : ''} auto-générée{pending.length - currentIdx > 1 ? 's' : ''} à valider
          </span>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <>
          {/* Difficulty */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Difficulté :</span>
            <div className="flex gap-0.5">
              {[1, 2, 3].map(d => (
                <div key={d} className={cn("h-1.5 w-1.5 rounded-full", d <= q.difficulty ? "bg-amber-500" : "bg-foreground/10")} />
              ))}
            </div>
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">{currentIdx + 1}/{pending.length}</span>
          </div>

          {/* Question */}
          <p className="text-xs font-medium text-foreground leading-relaxed">{q.question}</p>

          {/* Options */}
          <div className="space-y-1">
            {(q.options as string[]).map((opt, i) => (
              <div
                key={i}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center gap-2",
                  i === q.correct_index
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-border/30 text-muted-foreground"
                )}
              >
                <span className="font-mono text-[10px] shrink-0">{String.fromCharCode(65 + i)}.</span>
                <span>{opt}</span>
                {i === q.correct_index && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 ml-auto" />}
              </div>
            ))}
          </div>

          {/* Explanation */}
          <div className="text-[10px] text-muted-foreground bg-muted/40 rounded-lg p-2 border border-border/20">
            💡 {q.explanation}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-center pt-1">
            <button
              onClick={() => handleReject(q.id)}
              disabled={processing}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg border border-destructive/30 text-destructive text-[11px] font-medium hover:bg-destructive/10 transition-colors"
            >
              <XCircle className="h-3 w-3" /> Rejeter
            </button>
            <button
              onClick={() => handleValidate(q.id)}
              disabled={processing}
              className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" /> Valider
            </button>
          </div>
        </>
      )}
    </div>
  );
}
