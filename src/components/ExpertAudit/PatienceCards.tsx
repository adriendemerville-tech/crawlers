import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, Lightbulb, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PatienceCard {
  id: string;
  card_type: 'news' | 'tip';
  content: string;
  category: string;
}

interface SeasonalNews {
  headline: string;
  summary: string;
  news_type: string;
  relevance_score: number;
  keywords: string[];
}

interface SeasonalEvent {
  event_name: string;
  impact_level: string;
  peak_keywords: string[];
  is_in_peak: boolean;
  is_in_prep: boolean;
  days_until_start: number;
}

interface PatienceCardsProps {
  isActive: boolean;
  /** 'left' renders only news, 'right' only tip, 'both' renders both stacked, undefined uses legacy fixed positioning */
  position?: 'left' | 'right' | 'both';
  /** Optional: tracked site sector for personalized content */
  sector?: string | null;
}

export function PatienceCards({ isActive, position, sector }: PatienceCardsProps) {
  const [newsCard, setNewsCard] = useState<PatienceCard | null>(null);
  const [tipCard, setTipCard] = useState<PatienceCard | null>(null);
  const [seasonalNews, setSeasonalNews] = useState<SeasonalNews | null>(null);
  const [seasonalEvent, setSeasonalEvent] = useState<SeasonalEvent | null>(null);
  const [showNews, setShowNews] = useState(false);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    const fetchCards = async () => {
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

      // Fetch sector-specific seasonal data if sector available
      let sectorNews: SeasonalNews[] = [];
      let sectorEvents: SeasonalEvent[] = [];
      if (sector) {
        const [newsResult, eventResult] = await Promise.all([
          supabase.rpc('get_seasonal_news' as any, { p_sector: sector, p_geo: 'FR', p_limit: 5 }),
          supabase.rpc('get_active_seasonal_context' as any, { p_sector: sector, p_geo: 'FR' }),
        ]);
        sectorNews = (newsResult.data as SeasonalNews[]) || [];
        sectorEvents = (eventResult.data as SeasonalEvent[]) || [];
      }

      // Prioritize seasonal news over generic patience cards
      if (sectorNews.length > 0) {
        const picked = sectorNews[Math.floor(Math.random() * Math.min(sectorNews.length, 3))];
        setSeasonalNews(picked);
      } else if (newsCards.length > 0) {
        setNewsCard(newsCards[Math.floor(Math.random() * newsCards.length)] as PatienceCard);
      }

      // Seasonal events as contextual tips
      if (sectorEvents.length > 0) {
        const activeEvent = sectorEvents.find(e => e.is_in_peak) || sectorEvents.find(e => e.is_in_prep);
        if (activeEvent) setSeasonalEvent(activeEvent);
      }

      if (tipCards.length > 0) setTipCard(tipCards[Math.floor(Math.random() * tipCards.length)] as PatienceCard);
    };
    fetchCards();
  }, [isActive, sector]);

  useEffect(() => {
    if (!isActive) return;
    const newsTimer = setTimeout(() => setShowNews(true), 30_000);
    const hideNewsTimer = setTimeout(() => setShowNews(false), 70_000);
    const tipTimer = setTimeout(() => setShowTip(true), 85_000);
    const hideTipTimer = setTimeout(() => setShowTip(false), 130_000);
    return () => {
      clearTimeout(newsTimer);
      clearTimeout(hideNewsTimer);
      clearTimeout(tipTimer);
      clearTimeout(hideTipTimer);
    };
  }, [isActive]);

  if (!isActive) return null;

  // Build news content: prioritize seasonal news over generic patience cards
  const newsContent = seasonalNews
    ? `${seasonalNews.headline}${seasonalNews.summary ? ` — ${seasonalNews.summary}` : ''}`
    : newsCard?.content || null;

  const newsLabel = seasonalNews
    ? `${seasonalNews.news_type === 'seo' ? 'Actu SEO' : seasonalNews.news_type === 'geo' ? 'Actu GEO' : 'Actu secteur'} 🔥`
    : 'Actu SEO/GEO 🔥';

  // Build tip content: prioritize seasonal event over generic tips
  const tipContent = seasonalEvent
    ? `${seasonalEvent.event_name} ${seasonalEvent.is_in_peak ? '(en cours !)' : `dans ${seasonalEvent.days_until_start} jours`} — Mots-clés à cibler : ${(seasonalEvent.peak_keywords || []).slice(0, 3).join(', ')}`
    : tipCard?.content || null;

  const tipLabel = seasonalEvent ? '🗓️ Opportunité saisonnière' : 'Astuce Experte 💡';
  const TipIcon = seasonalEvent ? TrendingUp : Lightbulb;

  const newsElement = (
    <AnimatePresence>
      {showNews && newsContent && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
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
              {newsLabel}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-white/95">{newsContent}</p>
          <motion.div className="mt-3 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <motion.div className="h-full bg-white/70 rounded-full" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 30, ease: 'linear' }} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const tipElement = (
    <AnimatePresence>
      {showTip && tipContent && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="rounded-xl p-4 shadow-lg border"
          style={{
            background: seasonalEvent
              ? 'linear-gradient(135deg, hsl(30 80% 30%), hsl(30 70% 40%))'
              : 'linear-gradient(135deg, hsl(270 60% 30%), hsl(270 50% 40%))',
            borderColor: seasonalEvent
              ? 'hsl(30 70% 45% / 0.5)'
              : 'hsl(270 50% 45% / 0.5)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TipIcon className="h-4 w-4 text-white/90 shrink-0" />
            <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">
              {tipLabel}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-white/95">{tipContent}</p>
          <motion.div className="mt-3 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <motion.div className="h-full bg-white/70 rounded-full" initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: 30, ease: 'linear' }} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Inline positioning (used by AuditCompare)
  if (position === 'left') return newsElement;
  if (position === 'right') return tipElement;
  if (position === 'both') return <div className="space-y-4">{newsElement}{tipElement}</div>;

  // Legacy fixed positioning (used by ExpertAudit LoadingSteps)
  return (
    <>
      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden lg:block max-w-[280px]">
        {newsElement}
      </div>
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:block max-w-[280px]">
        {tipElement}
      </div>
    </>
  );
}
