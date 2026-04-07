import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, Link, IdCard, Radar, Target, Wrench, Network, BarChart3, 
  Star, FileSearch, PenTool, GitBranch, Smartphone, Gauge, Euro, Copy, 
  Play, Eye, Map, Lock, CheckCircle2, ChevronRight, Sparkles, Trophy,
  Loader2, RefreshCw, X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Icon map ───
const ICON_MAP: Record<string, any> = {
  search: Search, link: Link, 'id-card': IdCard, radar: Radar, target: Target,
  wrench: Wrench, network: Network, 'bar-chart': BarChart3, star: Star,
  'file-search': FileSearch, 'pen-tool': PenTool, 'git-branch': GitBranch,
  smartphone: Smartphone, gauge: Gauge, euro: Euro, copy: Copy,
  play: Play, eye: Eye, map: Map,
};

const MATURITY_LABELS: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Débutant', color: 'text-blue-500' },
  intermediate: { label: 'Intermédiaire', color: 'text-amber-500' },
  advanced: { label: 'Avancé', color: 'text-purple-500' },
  expert: { label: 'Expert', color: 'text-emerald-500' },
};

const MATURITY_ORDER = ['beginner', 'intermediate', 'advanced', 'expert'];

interface SmartRecommendation {
  recommendation_key: string;
  title: string;
  description: string;
  category: string;
  maturity_level: string;
  priority: number;
  is_unlocked: boolean;
  unlock_criteria_met: Record<string, boolean>;
  unlock_criteria_required: Record<string, any>;
  action_label: string;
  action_function: string | null;
  icon: string;
}

interface SmartRecommendationsProps {
  trackedSiteId: string;
  userId: string;
  language?: 'fr' | 'en' | 'es';
  onAction?: (rec: SmartRecommendation) => void;
}

export function SmartRecommendationsPanel({ trackedSiteId, userId, language = 'fr', onAction }: SmartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([]);
  const [maturity, setMaturity] = useState<{ level: string; criteria: Record<string, any> } | null>(null);
  const [summary, setSummary] = useState<{ unlocked: number; total: number; progress_pct: number; next_unlock_hint: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  const evaluate = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-recommendations', {
        body: { tracked_site_id: trackedSiteId },
      });
      if (error) throw error;
      if (data?.success) {
        setRecommendations(data.recommendations || []);
        setMaturity(data.site_maturity || null);
        setSummary(data.summary || null);
      }
    } catch (e) {
      console.error('[SmartReco] Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { evaluate(); }, [trackedSiteId]);

  const filteredRecs = useMemo(() => {
    let recs = recommendations.filter(r => !dismissedKeys.has(r.recommendation_key));
    if (filter === 'unlocked') recs = recs.filter(r => r.is_unlocked);
    if (filter === 'locked') recs = recs.filter(r => !r.is_unlocked);
    return recs;
  }, [recommendations, filter, dismissedKeys]);

  const groupedRecs = useMemo(() => {
    const groups: Record<string, SmartRecommendation[]> = {};
    for (const level of MATURITY_ORDER) {
      const items = filteredRecs.filter(r => r.maturity_level === level);
      if (items.length > 0) groups[level] = items;
    }
    return groups;
  }, [filteredRecs]);

  const handleDismiss = async (key: string) => {
    setDismissedKeys(prev => new Set([...prev, key]));
    await supabase.from('smart_recommendations' as any)
      .update({ status: 'dismissed' })
      .eq('tracked_site_id', trackedSiteId)
      .eq('recommendation_key', key);
  };

  if (loading) {
    return (
      <Card className="border-dashed border-muted/60">
        <CardContent className="py-8 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-full" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!maturity || !summary) return null;

  const maturityInfo = MATURITY_LABELS[maturity.level] || MATURITY_LABELS.beginner;

  return (
    <Card className="border-primary/20 overflow-hidden">
      {/* Header with maturity gauge */}
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Recommandations Intelligentes
                <Badge variant="outline" className={cn('text-[10px]', maturityInfo.color)}>
                  {maturityInfo.label}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                {summary.unlocked}/{summary.total} fonctionnalités débloquées
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => evaluate(true)}
            disabled={refreshing}
            className="text-xs gap-1"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Réévaluer
          </Button>
        </div>
        <Progress value={summary.progress_pct} className="h-1.5 mt-3" />
      </CardHeader>

      <CardContent className="pt-3 pb-4">
        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-4">
          {[
            { key: 'all' as const, label: `Tout (${recommendations.length - dismissedKeys.size})` },
            { key: 'unlocked' as const, label: `Débloqué (${recommendations.filter(r => r.is_unlocked).length})` },
            { key: 'locked' as const, label: `Verrouillé (${recommendations.filter(r => !r.is_unlocked).length})` },
          ].map(tab => (
            <Button
              key={tab.key}
              variant={filter === tab.key ? 'default' : 'outline'}
              size="sm"
              className="text-[10px] h-7 px-2.5"
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Next unlock hint */}
        {summary.next_unlock_hint && filter !== 'unlocked' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 flex items-start gap-2"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-[11px]">
              <span className="font-medium text-amber-600">Prochain déblocage :</span>{' '}
              <span className="text-muted-foreground">{summary.next_unlock_hint.title}</span>
              {summary.next_unlock_hint.missing?.length > 0 && (
                <span className="text-muted-foreground/70">
                  {' '}— Il manque : {summary.next_unlock_hint.missing.map(formatCriteriaLabel).join(', ')}
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* Grouped recommendations */}
        <div className="space-y-5">
          <AnimatePresence mode="popLayout">
            {Object.entries(groupedRecs).map(([level, recs]) => (
              <motion.div
                key={level}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('h-1.5 w-1.5 rounded-full', {
                    'bg-blue-500': level === 'beginner',
                    'bg-amber-500': level === 'intermediate',
                    'bg-purple-500': level === 'advanced',
                    'bg-emerald-500': level === 'expert',
                  })} />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {MATURITY_LABELS[level]?.label || level}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recs.map(rec => (
                    <RecommendationCard
                      key={rec.recommendation_key}
                      rec={rec}
                      onAction={onAction}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredRecs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {filter === 'unlocked' ? 'Aucune recommandation débloquée.' :
             filter === 'locked' ? 'Tout est débloqué ! 🎉' :
             'Aucune recommandation disponible.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Individual recommendation card ───
function RecommendationCard({ rec, onAction, onDismiss }: {
  rec: SmartRecommendation;
  onAction?: (rec: SmartRecommendation) => void;
  onDismiss: (key: string) => void;
}) {
  const IconComp = ICON_MAP[rec.icon] || Search;
  const isLocked = !rec.is_unlocked;

  const missingCriteria = Object.entries(rec.unlock_criteria_met || {})
    .filter(([_, met]) => !met)
    .map(([key]) => formatCriteriaLabel(key));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative p-3 rounded-lg border transition-colors group',
        isLocked
          ? 'border-muted/40 bg-muted/10 opacity-60'
          : 'border-primary/20 bg-background hover:border-primary/40 hover:shadow-sm'
      )}
    >
      {/* Dismiss button */}
      {!isLocked && (
        <button
          onClick={() => onDismiss(rec.recommendation_key)}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      )}

      <div className="flex items-start gap-2.5">
        <div className={cn(
          'p-1.5 rounded-lg shrink-0',
          isLocked ? 'bg-muted/30' : 'bg-primary/10'
        )}>
          {isLocked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <IconComp className="h-3.5 w-3.5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs font-medium leading-snug', isLocked && 'text-muted-foreground')}>
            {rec.title}
          </p>
          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
            {rec.description}
          </p>

          {isLocked && missingCriteria.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {missingCriteria.map(c => (
                <Badge key={c} variant="outline" className="text-[9px] px-1 py-0 bg-muted/20 text-muted-foreground border-muted/30">
                  {c}
                </Badge>
              ))}
            </div>
          )}

          {!isLocked && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2 mt-1.5 gap-1 text-primary hover:text-primary"
              onClick={() => onAction?.(rec)}
            >
              {(rec as any).action_label || 'Commencer'}
              <ChevronRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Human-readable criteria labels ───
function formatCriteriaLabel(key: string): string {
  const labels: Record<string, string> = {
    has_audit: 'Audit SEO',
    has_strategic_audit: 'Audit stratégique',
    has_gsc: 'Google Search Console',
    has_cms: 'CMS connecté',
    has_ga4: 'Google Analytics',
    has_identity_card: 'Carte d\'identité',
    has_cocoon: 'Cocon sémantique',
    has_corrective_code: 'Code correctif',
    seo_score_min: 'Score SEO minimum',
    crawl_count_min: 'Crawl(s) requis',
    pages_crawled_min: 'Pages crawlées min.',
    site_age_days_min: 'Ancienneté requise',
    audit_count_min: 'Nombre d\'audits min.',
  };
  return labels[key] || key;
}
