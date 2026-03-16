import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Code2, Lock, Clock, User, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminContext } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { PromptMatrixCard } from '@/components/Profile/PromptMatrixCard';

// ─── Edge functions registry grouped by category ───
const FUNCTION_CATEGORIES: Record<string, string[]> = {
  'Audit & SEO': [
    'audit-expert-seo', 'audit-local-seo', 'audit-strategique-ia', 'audit-compare',
    'expert-audit', 'save-audit', 'diagnose-hallucination', 'snapshot-audit-impact',
    'measure-audit-impact', 'generate-corrective-code',
  ],
  'Cocoon & Maillage': [
    'calculate-cocoon-logic', 'cocoon-chat', 'calculate-internal-pagerank', 'persist-cocoon-session',
  ],
  'Crawl & Analyse': [
    'crawl-site', 'process-crawl-queue', 'fetch-sitemap-tree', 'check-pagespeed',
    'validate-url', 'fetch-external-site', 'scan-wp',
  ],
  'LLM & Visibilité IA': [
    'check-llm', 'check-llm-depth', 'calculate-llm-visibility', 'calculate-llm-volumes',
    'refresh-llm-visibility-all', 'check-geo',
  ],
  'SERP & Data': [
    'fetch-serp-kpis', 'generate-more-keywords', 'generate-target-queries',
    'update-market-trends', 'check-crawlers', 'fetch-news',
  ],
  'GSC & GA4': [
    'gsc-auth', 'fetch-ga4-data',
  ],
  'Paiement & Abonnement': [
    'create-checkout', 'create-credit-checkout', 'create-subscription-session',
    'create-customer-portal', 'stripe-webhook', 'apply-affiliate', 'apply-referral',
    'apply-retention-offer',
  ],
  'Utilisateurs & Auth': [
    'ensure-profile', 'send-password-reset', 'send-verification-code', 'verify-email-code',
    'check-email-exists', 'verify-turnstile', 'manage-team',
  ],
  'Scripts & Déploiement': [
    'serve-client-script', 'get-final-script', 'process-script-queue', 'dry-run-script',
    'download-plugin', 'watchdog-scripts', 'update-config', 'wpsync', 'sdk-status', 'widget-connect',
  ],
  'Email & Notifications': [
    'process-email-queue', 'auth-email-hook', 'generate-blog-from-news',
  ],
  'Agent & Automation': [
    'agent-cto', 'agent-seo', 'refresh-serp-all', 'auto-measure-predictions',
    'generate-prediction', 'aggregate-observatory', 'archive-solution',
  ],
  'Partage & Rapport': [
    'share-report', 'resolve-share', 'track-share-click', 'summarize-report',
    'rss-feed', 'sitemap', 'track-analytics', 'generate-infotainment',
  ],
  'IAS & Metrics': [
    'calculate-ias', 'extract-pdf-data',
  ],
};

interface ConsultationLog {
  id: string;
  user_email: string;
  function_name: string;
  consulted_at: string;
}

interface AccessRequest {
  id: string;
  requester_email: string;
  function_name: string;
  status: string;
  created_at: string;
}

export function FunctionsManagement() {
  const { readOnly } = useAdminContext();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();

  const isViewer = readOnly;
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  const [functionCode, setFunctionCode] = useState<string>('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [consultationLogs, setConsultationLogs] = useState<ConsultationLog[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [viewerApproved, setViewerApproved] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const [showPromptMatrix, setShowPromptMatrix] = useState(false);
  const [matrixSiteId, setMatrixSiteId] = useState('');
  const [matrixDomain, setMatrixDomain] = useState('');

  // Load consultation logs and access requests for creator
  useEffect(() => {
    if (!isViewer) {
      loadConsultationLogs();
      loadAccessRequests();
    } else {
      loadMyRequests();
    }
  }, [isViewer]);

  const loadConsultationLogs = async () => {
    const { data } = await supabase
      .from('function_consultation_log' as any)
      .select('*')
      .order('consulted_at', { ascending: false })
      .limit(100);
    if (data) setConsultationLogs(data as any);
  };

  const loadAccessRequests = async () => {
    const { data } = await supabase
      .from('function_access_requests' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAccessRequests(data as any);
  };

  const loadMyRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('function_access_requests' as any)
      .select('*')
      .eq('requester_user_id', user.id);
    if (data) {
      const approved = new Set<string>();
      const pending = new Set<string>();
      (data as any[]).forEach((r: any) => {
        if (r.status === 'approved') approved.add(r.function_name);
        else if (r.status === 'pending') pending.add(r.function_name);
      });
      setViewerApproved(approved);
      setPendingRequests(pending);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const handleFunctionClick = async (fnName: string) => {
    if (isViewer) {
      // Check if already approved
      if (!viewerApproved.has(fnName)) {
        if (pendingRequests.has(fnName)) {
          toast({ title: 'Demande en attente', description: 'Votre demande est en cours de traitement.' });
          return;
        }
        // Send access request
        if (!user || !profile) return;
        await supabase.from('function_access_requests' as any).insert({
          requester_user_id: user.id,
          requester_email: profile.email,
          function_name: fnName,
        } as any);
        setPendingRequests(prev => new Set(prev).add(fnName));
        toast({ title: 'Demande envoyée', description: `Demande d'accès à ${fnName} envoyée au créateur.` });
        return;
      }
    }

    // Load function code via edge function
    setSelectedFunction(fnName);
    setLoadingCode(true);
    setDialogOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke('view-function-source', {
        body: { function_name: fnName },
      });
      if (error) {
        setFunctionCode(`// Erreur de chargement: ${error.message}\n// Fichier: supabase/functions/${fnName}/index.ts`);
      } else if (data?.code) {
        setFunctionCode(data.code);
      } else {
        setFunctionCode(`// Fonction: ${fnName}\n// Chemin: supabase/functions/${fnName}/index.ts\n// ${data?.message || 'Fonction déployée et active.'}`);
      }
    } catch {
      setFunctionCode(`// Erreur de chargement\n// Fichier: supabase/functions/${fnName}/index.ts`);
    }

    setLoadingCode(false);
  };

  const handleApproveRequest = async (requestId: string) => {
    await supabase
      .from('function_access_requests' as any)
      .update({ status: 'approved', resolved_at: new Date().toISOString(), resolved_by: user?.id } as any)
      .eq('id', requestId);
    loadAccessRequests();
    toast({ title: 'Accès approuvé' });
  };

  const handleRejectRequest = async (requestId: string) => {
    await supabase
      .from('function_access_requests' as any)
      .update({ status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: user?.id } as any)
      .eq('id', requestId);
    loadAccessRequests();
    toast({ title: 'Accès refusé' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Code2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Edge Functions</h2>
        <Badge variant="secondary" className="text-xs">
          {Object.values(FUNCTION_CATEGORIES).flat().length} fonctions
        </Badge>
      </div>

      {/* Access requests for creator */}
      {!isViewer && accessRequests.filter(r => r.status === 'pending').length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 space-y-2 mb-4">
          <p className="text-sm font-medium text-warning-foreground flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Demandes d'accès en attente
          </p>
          {accessRequests.filter(r => r.status === 'pending').map(req => (
            <div key={req.id} className="flex items-center justify-between bg-background/50 rounded p-2 text-xs">
              <span>{req.requester_email} → <code className="font-mono text-primary">{req.function_name}</code></span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleApproveRequest(req.id)}>Approuver</Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => handleRejectRequest(req.id)}>Refuser</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Function categories */}
      <div className="space-y-1">
        {Object.entries(FUNCTION_CATEGORIES).map(([category, functions]) => (
          <div key={category} className="border border-border/40 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedCategories.has(category) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span>{category}</span>
              </div>
              <Badge variant="outline" className="text-[10px]">{functions.length}</Badge>
            </button>

            {expandedCategories.has(category) && (
              <div className="border-t border-border/30 bg-muted/20">
                {functions.map(fn => {
                  const isPending = isViewer && pendingRequests.has(fn);
                  const isApproved = !isViewer || viewerApproved.has(fn);
                  return (
                    <button
                      key={fn}
                      onClick={() => handleFunctionClick(fn)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-1.5 text-xs font-mono hover:bg-muted/60 transition-colors text-left",
                        isPending && "opacity-60"
                      )}
                    >
                      <span className="text-foreground/80">{fn}</span>
                      {isViewer && !isApproved && !isPending && (
                        <Lock className="h-3 w-3 text-muted-foreground/50" />
                      )}
                      {isPending && (
                        <Badge variant="outline" className="text-[9px] h-4">En attente</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Code viewer dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm flex items-center gap-2">
              <Code2 className="h-4 w-4 text-primary" />
              {selectedFunction}/index.ts
            </DialogTitle>
          </DialogHeader>
          <div
            className="flex-1 overflow-auto rounded-lg bg-[#0d0820] p-4 select-none"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            onCopy={e => e.preventDefault()}
            onCut={e => e.preventDefault()}
          >
            {loadingCode ? (
              <div className="text-muted-foreground text-sm animate-pulse">Chargement...</div>
            ) : (
              <pre className="text-xs leading-relaxed font-mono text-green-300/90 whitespace-pre-wrap" style={{ userSelect: 'none' }}>
                {functionCode}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Consultation registry — creator only, at bottom */}
      {!isViewer && (
        <div className="mt-6 border-t border-border/40 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Registre des consultations</h3>
          </div>
          {consultationLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground/60">Aucune consultation enregistrée.</p>
          ) : (
            <div className="max-h-60 overflow-auto rounded-lg border border-border/30">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Utilisateur</th>
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Fonction</th>
                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {consultationLogs.map(log => (
                    <tr key={log.id} className="border-t border-border/20 hover:bg-muted/20">
                      <td className="px-3 py-1.5 flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground/50" />
                        {log.user_email}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-primary/80">{log.function_name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground/70">
                        {new Date(log.consulted_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
