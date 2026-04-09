import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, ChevronUp, ChevronDown, ExternalLink, Pause, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getBotIntent, getIntentLabel, getIntentColor, getBotIcon } from './botIntentMap';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface BotEntry {
  id: string;
  bot_name: string | null;
  bot_category: string | null;
  path: string | null;
  ts: string;
  status_code: number | null;
  tracked_site_id: string;
  domain?: string;
}

export function BotActivityWidget() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<BotEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!user) return;

    // Get user's tracked sites
    const { data: sites } = await supabase
      .from('tracked_sites')
      .select('id, domain')
      .eq('user_id', user.id);

    if (!sites || sites.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const siteIds = sites.map(s => s.id);
    const domainMap = Object.fromEntries(sites.map(s => [s.id, s.domain]));

    const { data } = await supabase
      .from('log_entries')
      .select('id, bot_name, bot_category, path, ts, status_code, tracked_site_id')
      .in('tracked_site_id', siteIds)
      .eq('is_bot', true)
      .order('ts', { ascending: false })
      .limit(20);

    if (data) {
      setEntries(data.map(e => ({ ...e, domain: domainMap[e.tracked_site_id] })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Polling every 30s when live
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(fetchEntries, 30000);
    return () => clearInterval(interval);
  }, [isLive, fetchEntries]);

  if (loading) {
    return (
      <Card className="border border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary animate-pulse" />
            Activité en direct
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return null; // Don't show widget if no bot data
  }

  return (
    <Card className="border border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="relative">
              <Activity className="h-4 w-4 text-primary" />
              {isLive && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            Activité en direct
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{entries.length} événements</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); setIsLive(!isLive); }}
            >
              {isLive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0 pb-3">
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {entries.map((entry, i) => {
                  const intent = getBotIntent(entry.bot_name);
                  const intentLabel = getIntentLabel(intent);
                  const intentColor = getIntentColor(intent);
                  const icon = getBotIcon(entry.bot_name);

                  return (
                    <motion.div
                      key={entry.id}
                      initial={i < 3 ? { opacity: 0, x: -10 } : false}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/30 transition-colors group"
                    >
                      <span className="text-lg flex-shrink-0 w-6 text-center">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{entry.bot_name || 'Bot inconnu'}</span>
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 border', intentColor)}>
                            {intentLabel}
                          </Badge>
                          {entry.domain && (
                            <span className="text-[10px] text-muted-foreground hidden group-hover:inline">
                              {entry.domain}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.path || '/'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.ts), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-3 pt-2 border-t border-border/30">
                <Link to="/app/bot-activity">
                  <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground gap-1">
                    Voir toute l'activité
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
