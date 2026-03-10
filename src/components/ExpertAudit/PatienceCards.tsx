import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, Lightbulb } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

interface PatienceCard {
  id: string;
  card_type: 'news' | 'tip';
  content: string;
  category: string;
}

interface PatienceCardsProps {
  isActive: boolean;
}

export function PatienceCards({ isActive }: PatienceCardsProps) {
  const isMobile = useIsMobile();
  const [newsCard, setNewsCard] = useState<PatienceCard | null>(null);
  const [tipCard, setTipCard] = useState<PatienceCard | null>(null);
  const [showNews, setShowNews] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [startTime] = useState(Date.now());

  // Fetch random cards on mount
  useEffect(() => {
    if (!isActive) return;

    const fetchCards = async () => {
      // Fetch one random news card and one random tip card
      const [newsRes, tipRes] = await Promise.all([
        supabase
          .from('patience_cards' as any)
          .select('id, card_type, content, category')
          .eq('card_type', 'news')
          .eq('is_active', true)
          .order('relevance_score', { ascending: false })
          .limit(10),
        supabase
          .from('patience_cards' as any)
          .select('id, card_type, content, category')
          .eq('card_type', 'tip')
          .eq('is_active', true)
          .order('relevance_score', { ascending: false })
          .limit(10),
      ]);

      const newsCards = (newsRes.data as any[]) || [];
      const tipCards = (tipRes.data as any[]) || [];

      if (newsCards.length > 0) {
        setNewsCard(newsCards[Math.floor(Math.random() * newsCards.length)] as PatienceCard);
      }
      if (tipCards.length > 0) {
        setTipCard(tipCards[Math.floor(Math.random() * tipCards.length)] as PatienceCard);
      }
    };

    fetchCards();
  }, [isActive]);

  // Timers for showing/hiding cards
  useEffect(() => {
    if (!isActive) return;

    // Show news at 45s
    const newsTimer = setTimeout(() => setShowNews(true), 45_000);
    // Hide news at 75s (45 + 30)
    const hideNewsTimer = setTimeout(() => setShowNews(false), 75_000);
    // Show tip at 90s
    const tipTimer = setTimeout(() => setShowTip(true), 90_000);
    // Hide tip at 120s (90 + 30)
    const hideTipTimer = setTimeout(() => setShowTip(false), 120_000);

    return () => {
      clearTimeout(newsTimer);
      clearTimeout(hideNewsTimer);
      clearTimeout(tipTimer);
      clearTimeout(hideTipTimer);
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <>
      {/* Left column - News card (green) */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden lg:block max-w-[280px]">
        <AnimatePresence>
          {showNews && newsCard && (
            <motion.div
              initial={{ opacity: 0, x: -40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.9 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="rounded-xl p-4 shadow-lg border"
              style={{
                background: 'linear-gradient(135deg, hsl(142 71% 25%), hsl(142 60% 35%))',
                borderColor: 'hsl(142 60% 40% / 0.5)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Newspaper className="h-4 w-4 text-white/90 shrink-0" />
                <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">
                  Actu SEO/GEO 🔥
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-white/95">
                {newsCard.content}
              </p>
              {/* Progress bar for auto-dismiss */}
              <motion.div
                className="mt-3 h-0.5 rounded-full bg-white/30 overflow-hidden"
              >
                <motion.div
                  className="h-full bg-white/70 rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 30, ease: 'linear' }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right column - Tip card (purple) */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:block max-w-[280px]">
        <AnimatePresence>
          {showTip && tipCard && (
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="rounded-xl p-4 shadow-lg border"
              style={{
                background: 'linear-gradient(135deg, hsl(270 60% 30%), hsl(270 50% 40%))',
                borderColor: 'hsl(270 50% 45% / 0.5)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-white/90 shrink-0" />
                <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">
                  Astuce Experte 💡
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-white/95">
                {tipCard.content}
              </p>
              <motion.div
                className="mt-3 h-0.5 rounded-full bg-white/30 overflow-hidden"
              >
                <motion.div
                  className="h-full bg-white/70 rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: 30, ease: 'linear' }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
