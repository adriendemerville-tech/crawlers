import { useState, useEffect, useCallback } from 'react';
import { useCanonicalHreflang } from '@/hooks/useCanonicalHreflang';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, ArrowLeft, Pause, Play, Filter, Bot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getBotIntent, getIntentLabel, getIntentColor, BotIntent } from '@/components/BotActivity/botIntentMap';
import { VerificationBadge } from '@/components/BotActivity/VerificationBadge';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

/** Parse a ts value that may be a Unix epoch in seconds (1970-based) or a valid ISO string */
function safeParseTs(ts: string): Date {
  const d = new Date(ts);
  // If the parsed date is before 2020, it's likely a Unix epoch stored as a timestamp column
  // e.g. "1970-01-21 13:11:46" = 1,776,706s = real date in 2026
  if (d.getFullYear() < 2020) {
    // Extract epoch seconds from the 1970-based date
    const epochMs = d.getTime();
    if (epochMs > 0 && epochMs < 4_102_444_800_000) {
      // Interpret as seconds, multiply by 1000
      return new Date(epochMs * 1000);
    }
  }
  return d;
}
import { Helmet } from 'react-helmet-async';
import { Skeleton } from '@/components/ui/skeleton';

interface BotEntry {
  id: string;
  bot_name: string | null;
  bot_category: string | null;
  path: string | null;
  ts: string;
  status_code: number | null;
  tracked_site_id: string;
  domain?: string;
  verification_status?: 'verified' | 'suspect' | 'stealth' | 'unverified' | null;
  verification_method?: 'rdns_match' | 'asn_range' | 'ua_only' | 'behavioral' | 'none' | null;
  confidence_score?: number | null;
}

interface TrackedSite {
  id: string;
  domain: string;
}

export default function BotActivityPage() {
  const { user } = useAuth();
  useCanonicalHreflang('/app/bot-activity');
  const navigate = useNavigate();
  const [entries, setEntries] = useState<BotEntry[]>([]);
  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [selectedIntent, setSelectedIntent] = useState<string>('all');
  const [selectedTrust, setSelectedTrust] = useState<string>('all');
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchSites = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tracked_sites')
      .select('id, domain')
      .eq('user_id', user.id);
    if (data) setSites(data);
  }, [user]);

  const fetchEntries = useCallback(async () => {
    if (!user || sites.length === 0) return;

    const siteIds = selectedSite === 'all' ? sites.map(s => s.id) : [selectedSite];
    const domainMap = Object.fromEntries(sites.map(s => [s.id, s.domain]));

    let query = supabase
      .from('log_entries')
      .select('id, bot_name, bot_category, path, ts, status_code, tracked_site_id, verification_status, verification_method, confidence_score')
      .in('tracked_site_id', siteIds)
      .eq('is_bot', true)
      .order('ts', { ascending: false })
      .limit(100);

    const { data } = await query;

    if (data) {
      let filtered: BotEntry[] = (data as any[]).map(e => ({
        ...e,
        domain: domainMap[e.tracked_site_id],
        verification_status: e.verification_status as BotEntry['verification_status'],
        verification_method: e.verification_method as BotEntry['verification_method'],
      }));

      if (selectedIntent !== 'all') {
        filtered = filtered.filter(e => getBotIntent(e.bot_name) === selectedIntent);
      }
      if (selectedTrust !== 'all') {
        filtered = filtered.filter(e => (e.verification_status || 'unverified') === selectedTrust);
      }

      setEntries(filtered);
    }
    setLoading(false);
  }, [user, sites, selectedSite, selectedIntent, selectedTrust]);

  useEffect(() => { fetchSites(); }, [fetchSites]);
  useEffect(() => { if (sites.length > 0) fetchEntries(); }, [sites, fetchEntries]);

  useEffect(() => {
    if (!isLive || sites.length === 0) return;
    const interval = setInterval(fetchEntries, 15000);
    return () => clearInterval(interval);
  }, [isLive, sites, fetchEntries]);

  // Stats
  const stats = {
    total: entries.length,
    training: entries.filter(e => getBotIntent(e.bot_name) === 'training').length,
    fetchUser: entries.filter(e => getBotIntent(e.bot_name) === 'fetch_user').length,
    indexing: entries.filter(e => getBotIntent(e.bot_name) === 'indexing').length,
    uniqueBots: new Set(entries.map(e => e.bot_name).filter(Boolean)).size,
  };

  return (
    <>
      <Helmet>
        <title>Activité des Bots — Crawlers AI</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container max-w-5xl mx-auto py-6 px-4 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/app/console')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Activité des Bots
                {isLive && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">Suivi en temps réel des visites de bots sur vos sites</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsLive(!isLive)}
            >
              {isLive ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Live</>}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total visites</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{stats.training}</p>
                <p className="text-xs text-muted-foreground">Entraînement IA</p>
              </CardContent>
            </Card>
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-orange-600">{stats.fetchUser}</p>
                <p className="text-xs text-muted-foreground">Fetch utilisateur</p>
              </CardContent>
            </Card>
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.indexing}</p>
                <p className="text-xs text-muted-foreground">Indexation</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tous les sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les sites</SelectItem>
                {sites.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedIntent} onValueChange={setSelectedIntent}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Toutes les intentions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les intentions</SelectItem>
                <SelectItem value="training">Entrainement</SelectItem>
                <SelectItem value="fetch_user">Fetch utilisateur</SelectItem>
                <SelectItem value="indexing">Indexation</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {stats.uniqueBots} bots uniques
            </span>
          </div>

          {/* Entries list */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : entries.length === 0 ? (
                <div className="p-12 text-center">
                  <Bot className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Aucune activité de bot détectée</p>
                  <p className="text-xs text-muted-foreground mt-1">Connectez vos logs serveur pour commencer le suivi</p>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {entries.map((entry, i) => {
                    const intent = getBotIntent(entry.bot_name);
                    const intentLabel = getIntentLabel(intent);
                    const intentColor = getIntentColor(intent);

                    return (
                      <motion.div
                        key={entry.id}
                        initial={i < 5 ? { opacity: 0, y: 5 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.2 }}
                        className="flex items-center gap-3 py-3 px-4 hover:bg-muted/20 transition-colors"
                      >
                        <Bot className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{entry.bot_name || 'Bot inconnu'}</span>
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 border', intentColor)}>
                              {intentLabel}
                            </Badge>
                            {entry.status_code && entry.status_code >= 400 && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                                {entry.status_code}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground truncate">{entry.path || '/'}</p>
                            {entry.domain && (
                              <span className="text-[10px] text-muted-foreground/60">• {entry.domain}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(safeParseTs(entry.ts), { addSuffix: true, locale: fr })}
                          </span>
                          <p className="text-[10px] text-muted-foreground/50">
                            {format(safeParseTs(entry.ts), 'HH:mm:ss')}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
