import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Bug, Bell } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const fetchActiveJobs = async () => {
      const { data } = await supabase
        .from('site_crawls')
        .select('id, domain, status, crawled_pages, total_pages')
        .in('status', ['queued', 'mapping', 'crawling', 'analyzing'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        setActiveJobs(data.map(d => ({
          crawl_id: d.id,
          domain: d.domain,
          status: d.status,
          crawled_pages: d.crawled_pages,
          total_pages: d.total_pages,
        })));
      } else {
        // Check if any recently completed (last 30s) to show notification
        const { data: recent } = await supabase
          .from('site_crawls')
          .select('id, domain, status, crawled_pages, total_pages, completed_at')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1);

        if (recent && recent.length > 0 && recent[0].completed_at) {
          const completedAt = new Date(recent[0].completed_at);
          const now = new Date();
          const diffMs = now.getTime() - completedAt.getTime();
          
          if (diffMs < 30000 && !completedIds.has(recent[0].id)) {
            // Just completed — show notification + play sound
            setCompletedIds(prev => new Set(prev).add(recent[0].id));
            
            try {
              const audio = new Audio(microwaveDing);
              audio.volume = 0.6;
              audio.play().catch(() => {});
            } catch {}
            
            toast.success(`✅ Audit de ${recent[0].domain} terminé : ${recent[0].crawled_pages} pages !`, {
              duration: 15000,
              action: {
                label: t.viewReport,
                onClick: () => navigate('/site-crawl'),
              },
            });
          }
        }
        setActiveJobs([]);
      }
    };

    fetchActiveJobs();
    const interval = setInterval(fetchActiveJobs, 5000);
    return () => clearInterval(interval);
  }, [user]);

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
