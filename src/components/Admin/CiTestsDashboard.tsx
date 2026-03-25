import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FlaskConical, Loader2, CheckCircle2, XCircle, Clock, RefreshCw, History, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface TestResult {
  id: string;
  name: string;
  pillar: string;
  passed: boolean;
  duration_ms: number;
  error?: string;
}

interface TestRun {
  success: boolean;
  summary: { total: number; passed: number; failed: number; duration_ms: number };
  results: TestResult[];
}

interface HistoryEntry {
  created_at: string;
  event_data: {
    total: number;
    passed: number;
    failed: number;
    all_passed: boolean;
    duration_ms: number;
    results: TestResult[];
  };
}

const PILLAR_COLORS: Record<string, string> = {
  'Sécurité': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Facturation': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Audit': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Tracking': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

function HistoryRow({
  allPassed, date, passed, total, failed, durationMs, failedTests, hasFails,
}: {
  allPassed: boolean;
  date: Date;
  passed: number;
  total: number;
  failed: number;
  durationMs: number;
  failedTests: TestResult[];
  hasFails: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => hasFails && setOpen(o => !o)}
        className={`flex items-center gap-3 px-3 py-2 w-full text-left text-sm transition-colors ${
          allPassed
            ? 'bg-green-50/50 dark:bg-green-900/5'
            : 'bg-red-50/50 dark:bg-red-900/5'
        } ${hasFails ? 'cursor-pointer hover:bg-red-100/50 dark:hover:bg-red-900/10' : ''}`}
      >
        {allPassed ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        )}
        <span className="text-muted-foreground text-xs">
          {date.toLocaleDateString('fr-FR')} {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        {allPassed ? (
          <span className="font-medium text-green-700 dark:text-green-400">
            {total}/{total} réussis
          </span>
        ) : (
          <span className="font-medium text-foreground">
            <span className="text-green-700 dark:text-green-400">{passed} réussi{passed > 1 ? 's' : ''}</span>
            <span className="text-muted-foreground mx-1">·</span>
            <span className="text-red-600 dark:text-red-400">{failed} échoué{failed > 1 ? 's' : ''}</span>
          </span>
        )}
        <span className="text-muted-foreground text-xs ml-auto flex items-center gap-1">
          {durationMs}ms
          {hasFails && (
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          )}
        </span>
      </button>

      <AnimatePresence>
        {open && failedTests.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2 space-y-1 bg-red-50/30 dark:bg-red-900/5 border-t border-red-200/30 dark:border-red-800/20">
              {failedTests.map((ft) => (
                <div key={ft.id} className="flex items-start gap-2 text-xs">
                  <XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                  <span className="font-medium text-red-700 dark:text-red-400">{ft.name}</span>
                  {ft.error && (
                    <span className="text-muted-foreground">— {ft.error}</span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CiTestsDashboard() {
  const [running, setRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<TestRun | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from('analytics_events')
        .select('created_at, event_data')
        .eq('event_type', 'ci_test_run')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setHistory(data as unknown as HistoryEntry[]);
      }
    } catch {
      // silencieux
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRunTests = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setCurrentRun(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('run-backend-tests');
      if (fnError) throw fnError;
      setCurrentRun(data as TestRun);
      await fetchHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header + bouton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FlaskConical className="h-5 w-5 text-primary" />
          </div>
          <div>
           <h3 className="text-lg font-semibold">Tests d'intégration backend</h3>
            <p className="text-sm text-muted-foreground">
              12 tests couvrant sécurité, facturation, audit et tracking
            </p>
          </div>
        </div>
        <Button onClick={handleRunTests} disabled={running} size="sm" className="gap-2">
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exécution…
            </>
          ) : (
            <>
              <FlaskConical className="h-4 w-4" />
              Lancer les tests
            </>
          )}
        </Button>
      </div>

      {/* Erreur globale */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-sm text-destructive font-medium">❌ Erreur : {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Résultats du run courant */}
      {currentRun && (
        <Card className={currentRun.success ? 'border-green-500/50' : 'border-destructive/50'}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {currentRun.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              {currentRun.success ? 'Tous les tests passés' : `${currentRun.summary.failed} test(s) échoué(s)`}
              <span className="text-muted-foreground font-normal ml-auto">
                {currentRun.summary.passed}/{currentRun.summary.total} • {currentRun.summary.duration_ms}ms
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentRun.results.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                    r.passed
                      ? 'bg-green-50 dark:bg-green-900/10'
                      : 'bg-red-50 dark:bg-red-900/10'
                  }`}
                >
                  {r.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                  )}
                  <span className="font-medium">{r.name}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PILLAR_COLORS[r.pillar] || ''}`}>
                    {r.pillar}
                  </Badge>
                  <span className="text-muted-foreground text-xs ml-auto flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {r.duration_ms}ms
                  </span>
                  {r.error && (
                    <span className="text-red-600 text-xs max-w-[300px] truncate" title={r.error}>
                      {r.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historique des exécutions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4" />
            Historique des exécutions
            <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={fetchHistory}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune exécution enregistrée. Lancez les tests pour commencer.
            </p>
          ) : (
            <div className="space-y-1.5">
              {history.map((entry, i) => {
                const d = entry.event_data;
                const date = new Date(entry.created_at);
                const failedTests = d.results?.filter(r => !r.passed) || [];
                const hasFails = failedTests.length > 0;

                return (
                  <HistoryRow
                    key={i}
                    allPassed={d.all_passed}
                    date={date}
                    passed={d.passed}
                    total={d.total}
                    failed={d.failed}
                    durationMs={d.duration_ms}
                    failedTests={failedTests}
                    hasFails={hasFails}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
