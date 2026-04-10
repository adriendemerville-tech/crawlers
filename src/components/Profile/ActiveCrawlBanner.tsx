import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Bug, Bell } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import microwaveDing from '@/assets/sounds/microwave-ding.mp3';
import { toast } from 'sonner';

const translations = {
  fr: {
    title: 'Audit Multi-Pages en cours',
    queued: 'En file d\'attente…',
    mapping: 'Mapping du site…',
    crawling: 'Analyse en cours',
    analyzing: 'Synthèse IA en cours…',
    completed: 'Audit terminé !',
    error: 'Erreur',
    pages: 'pages analysées',
    notification: 'Vous recevrez une notification dès que l\'audit sera terminé.',
    viewReport: 'Voir le rapport complet',
  },
  en: {
    title: 'Multi-Page Audit in Progress',
    queued: 'Queued…',
    mapping: 'Mapping site…',
    crawling: 'Analyzing',
    analyzing: 'AI summary in progress…',
    completed: 'Audit complete!',
    error: 'Error',
    pages: 'pages analyzed',
    notification: 'You will receive a notification when the audit is complete.',
    viewReport: 'View full report',
  },
  es: {
    title: 'Auditoría Multi-Página en curso',
    queued: 'En cola…',
    mapping: 'Mapeando el sitio…',
    crawling: 'Analizando',
    analyzing: 'Resumen IA en curso…',
    completed: '¡Auditoría completada!',
    error: 'Error',
    pages: 'páginas analizadas',
    notification: 'Recibirás una notificación cuando la auditoría esté terminada.',
    viewReport: 'Ver informe completo',
  },
};

interface ActiveJob {
  crawl_id: string;
  domain: string;
  status: string;
  crawled_pages: number;
  total_pages: number;
}

export function ActiveCrawlBanner() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = translations[language];
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const hadActiveJobsRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActiveJobs = useCallback(async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('site_crawls')
        .select('id, domain, status, crawled_pages, total_pages')
        .eq('user_id', user.id)
        .in('status', ['queued', 'mapping', 'crawling', 'analyzing'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        hadActiveJobsRef.current = true;
        setActiveJobs(data.map(d => ({
          crawl_id: d.id,
          domain: d.domain,
          status: d.status,
          crawled_pages: d.crawled_pages,
          total_pages: d.total_pages,
        })));
      } else {
        // Jobs just finished — notify once per crawl, then stop polling
        if (hadActiveJobsRef.current) {
          hadActiveJobsRef.current = false;

          const { data: recent } = await supabase
            .from('site_crawls')
            .select('id, domain, crawled_pages, completed_at')
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1);

          if (recent?.[0] && !notifiedIdsRef.current.has(recent[0].id)) {
            const completedAt = new Date(recent[0].completed_at!);
            const diffMs = Date.now() - completedAt.getTime();

            if (diffMs < 60000) {
              notifiedIdsRef.current.add(recent[0].id);
              try {
                const audio = new Audio(microwaveDing);
                audio.volume = 0.6;
                audio.play().catch(() => {});
              } catch {}
              toast.success(`✅ Audit de ${recent[0].domain} terminé : ${recent[0].crawled_pages} pages !`, {
                duration: 15000,
                action: {
                  label: t.viewReport,
                  onClick: () => navigate('/app/site-crawl'),
                },
              });
            }
          }
        }

        setActiveJobs([]);

        // Stop polling — no active jobs
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch {
      // silent
    }
  }, [user, t.viewReport, navigate]);

  // Initial check + start polling only if active jobs found
  useEffect(() => {
    if (!user) return;

    // Initial fetch
    const init = async () => {
      await fetchActiveJobs();
      // Only start polling if we found active jobs
      if (hadActiveJobsRef.current && !intervalRef.current) {
        intervalRef.current = setInterval(fetchActiveJobs, 5000);
      }
    };
    init();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, fetchActiveJobs]);

  // Listen for new crawl starts via realtime or re-check periodically (every 30s instead of 5s when idle)
  useEffect(() => {
    if (!user) return;
    // Light check every 30s when idle to detect new crawls started from other tabs
    const idleCheck = setInterval(() => {
      if (!intervalRef.current) {
        fetchActiveJobs().then(() => {
          if (hadActiveJobsRef.current && !intervalRef.current) {
            intervalRef.current = setInterval(fetchActiveJobs, 5000);
          }
        });
      }
    }, 30000);
    return () => clearInterval(idleCheck);
  }, [user, fetchActiveJobs]);

  if (activeJobs.length === 0) return null;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'queued': return t.queued;
      case 'mapping': return t.mapping;
      case 'crawling': return t.crawling;
      case 'analyzing': return t.analyzing;
      default: return status;
    }
  };

  return (
    <div className="space-y-3">
      {activeJobs.map(job => {
        const progressPct = job.total_pages > 0
          ? Math.round((job.crawled_pages / job.total_pages) * 100)
          : 0;

        return (
          <Card key={job.crawl_id} className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Bug className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{t.title}</h4>
                    <Badge variant="outline" className="text-[10px]">
                      {job.domain}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {getStatusLabel(job.status)}
                    {job.status === 'crawling' && ` — ${job.crawled_pages}/${job.total_pages} ${t.pages}`}
                  </p>
                </div>
                <span className="text-sm font-mono font-bold text-primary">{progressPct}%</span>
              </div>

              <Progress value={progressPct} className="h-2 mb-2" />

              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Bell className="h-3 w-3" />
                {t.notification}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
