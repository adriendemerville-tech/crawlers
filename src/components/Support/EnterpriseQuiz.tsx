import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Send, Loader2, Building2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EnterpriseQuizProps {
  userId?: string;
  onComplete: (summary: string) => void;
}

const QUESTIONS = [
  { id: 'name', label: 'Votre nom complet', placeholder: 'Jean Dupont', type: 'text' as const },
  { id: 'company', label: 'Nom de votre entreprise', placeholder: 'Acme Corp', type: 'text' as const },
  { id: 'website', label: 'URL de votre site principal', placeholder: 'https://www.example.com', type: 'url' as const },
  { id: 'pages', label: 'Nombre de pages estimé sur votre site', placeholder: '500', type: 'number' as const },
  { id: 'revenue', label: 'Chiffre d\'affaires de l\'année dernière (€)', placeholder: '1 500 000', type: 'text' as const },
  { id: 'seats', label: 'Nombre de postes à équiper', placeholder: '10', type: 'number' as const },
  { id: 'needs', label: 'Quels sont vos besoins prioritaires ?', placeholder: 'SEO technique, contenu, suivi de positions…', type: 'textarea' as const },
];

export function EnterpriseQuiz({ userId, onComplete }: EnterpriseQuizProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentValue, setCurrentValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const q = QUESTIONS[currentIdx];
  const isLast = currentIdx === QUESTIONS.length - 1;
  const progress = ((currentIdx) / QUESTIONS.length) * 100;

  const handleNext = () => {
    if (!currentValue.trim()) return;
    const updated = { ...answers, [q.id]: currentValue.trim() };
    setAnswers(updated);
    setCurrentValue('');

    if (isLast) {
      handleSubmit(updated);
    } else {
      setCurrentIdx(i => i + 1);
    }
  };

  const handleSubmit = async (finalAnswers: Record<string, string>) => {
    setSubmitting(true);
    try {
      // Save to support_messages as admin-visible notification
      const summary = QUESTIONS.map(q => `**${q.label}** : ${finalAnswers[q.id] || '—'}`).join('\n');

      await supabase.from('support_messages').insert({
        conversation_id: null as any,
        content: `🏢 **Demande Enterprise**\n\n${summary}`,
        is_admin: false,
        sender_name: finalAnswers.name || 'Prospect Enterprise',
      } as any);

      // Also insert into analytics_events for tracking
      await supabase.from('analytics_events').insert({
        event_type: 'enterprise_contact',
        user_id: userId || null,
        event_data: finalAnswers,
        url: '/pro-agency',
      });

      setDone(true);
      onComplete(`✅ **Merci ${finalAnswers.name || ''} !**\n\nVotre demande pour **${finalAnswers.company || 'votre entreprise'}** a bien été transmise à notre équipe commerciale. Nous vous recontacterons sous 24h ouvrées pour discuter d'une offre Enterprise sur mesure.`);
    } catch (err) {
      console.error('Enterprise quiz submit error:', err);
      onComplete("✅ Merci ! Votre demande a été enregistrée. Notre équipe vous contactera rapidement.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return null;

  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-emerald-500" />
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          Offre Enterprise — Questionnaire
        </span>
        <span className="text-[10px] font-mono text-muted-foreground ml-auto">
          {currentIdx + 1}/{QUESTIONS.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question */}
      <p className="text-xs font-medium text-foreground">{q.label}</p>

      {/* Input */}
      <div className="flex gap-2">
        {q.type === 'textarea' ? (
          <textarea
            value={currentValue}
            onChange={e => setCurrentValue(e.target.value)}
            placeholder={q.placeholder}
            rows={2}
            className="flex-1 text-xs rounded-lg border border-border/50 bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNext(); } }}
            autoFocus
          />
        ) : (
          <input
            type={q.type === 'number' ? 'text' : q.type}
            value={currentValue}
            onChange={e => setCurrentValue(e.target.value)}
            placeholder={q.placeholder}
            className="flex-1 text-xs rounded-lg border border-border/50 bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            onKeyDown={e => { if (e.key === 'Enter') handleNext(); }}
            autoFocus
          />
        )}
        <button
          onClick={handleNext}
          disabled={!currentValue.trim() || submitting}
          className={cn(
            "shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
            currentValue.trim()
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-muted text-muted-foreground"
          )}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isLast ? (
            <Send className="h-3.5 w-3.5" />
          ) : (
            <ArrowRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
