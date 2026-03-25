import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { computeAutonomyScore, type AutonomyResult } from '@/utils/autonomyScore';
import { supabase } from '@/integrations/supabase/client';

interface AutonomyDiagnosticProps {
  userId: string;
  persona: string | null;
  onComplete: (result: AutonomyResult) => void;
}

const LABELS_SEO = ['Novice', 'Débutant', 'Intermédiaire', 'Avancé', 'Expert'];
const LABELS_AUTO = ['Guidé', 'Accompagné', 'Autonome', 'Indépendant', 'Expert'];

export function AutonomyDiagnostic({ userId, persona, onComplete }: AutonomyDiagnosticProps) {
  const [step, setStep] = useState(0); // 0 = SEO knowledge, 1 = autonomy
  const [seoKnowledge, setSeoKnowledge] = useState(3);
  const [autonomySelf, setAutonomySelf] = useState(3);
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    const result = computeAutonomyScore(persona, seoKnowledge, autonomySelf);

    try {
      await supabase
        .from('profiles')
        .update({
          autonomy_score: result.score,
          autonomy_level: result.level,
          autonomy_raw: result.raw as any,
        })
        .eq('user_id', userId);
    } catch (e) {
      console.error('Failed to save autonomy score:', e);
    }

    setSaving(false);
    onComplete(result);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1a1035]/80 border border-white/10 rounded-xl p-4 mx-2 my-2 space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
        <Brain className="w-4 h-4 text-[#7C3AED]" />
        <span>Diagnostic rapide</span>
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="seo"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <p className="text-white/70 text-xs leading-relaxed">
              En <strong className="text-white/90">SEO & GEO</strong>, comment évalues-tu tes connaissances ?
            </p>
            <div className="px-1">
              <Slider
                value={[seoKnowledge]}
                onValueChange={([v]) => setSeoKnowledge(v)}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1.5">
                {LABELS_SEO.map((l, i) => (
                  <span
                    key={i}
                    className={`text-[10px] transition-colors ${
                      i + 1 === seoKnowledge ? 'text-[#7C3AED] font-semibold' : 'text-white/30'
                    }`}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => setStep(1)}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1 text-xs h-7"
              >
                Suivant <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="auto"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <p className="text-white/70 text-xs leading-relaxed">
              Quel est ton <strong className="text-white/90">niveau d'autonomie</strong> en optimisation web ?
            </p>
            <div className="px-1">
              <Slider
                value={[autonomySelf]}
                onValueChange={([v]) => setAutonomySelf(v)}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between mt-1.5">
                {LABELS_AUTO.map((l, i) => (
                  <span
                    key={i}
                    className={`text-[10px] transition-colors ${
                      i + 1 === autonomySelf ? 'text-[#7C3AED] font-semibold' : 'text-white/30'
                    }`}
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleFinish}
                disabled={saving}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1 text-xs h-7"
              >
                {saving ? 'Enregistrement…' : (
                  <>C'est parti ! <Sparkles className="w-3 h-3" /></>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
