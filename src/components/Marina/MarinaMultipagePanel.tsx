import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Layers, Loader2, FolderSearch, FileText, X, Check, AlertTriangle } from 'lucide-react';
import { MarinaReportPreviewModal } from '@/components/Admin/MarinaReportPreviewModal';
import { mergeMarinaReports } from '@/lib/marina/mergeReports';

const MAX_URLS = 15;
const CREDIT_COST = 5;
const CONCURRENCY = 2;
const STORAGE_KEY = 'marina_batch_v2';

type ItemStatus = 'pending' | 'running' | 'completed' | 'failed';

interface BatchItem {
  url: string;
  status: ItemStatus;
  progress: number;
  jobId?: string;
  error?: string;
}

interface Props {
  isAuthenticated: boolean;
  credits: number;
  language: string;
  useCredit: (description: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  refreshCredits: () => void;
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/[,;]+$/, '');
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(candidate);
    if (!u.hostname.includes('.')) return null;
    return u.toString().replace(/\/$/, '') || u.toString();
  } catch {
    return null;
  }
}

function flattenTreeUrls(tree: any[]): string[] {
  const out: string[] = [];
  const walk = (nodes: any[]) => {
    for (const n of nodes || []) {
      if (Array.isArray(n?.urls)) out.push(...n.urls);
      if (Array.isArray(n?.children)) walk(n.children);
    }
  };
  walk(tree);
  return [...new Set(out)];
}

export function MarinaMultipagePanel({ isAuthenticated, credits, language, useCredit, refreshCredits }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'paste' | 'directory'>('paste');
  const [rawUrls, setRawUrls] = useState('');
  const [dirInput, setDirInput] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [buildingPdf, setBuildingPdf] = useState(false);
  const [mergedHtml, setMergedHtml] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const cancelRef = useRef(false);

  /* ── Reprise d'un batch interrompu (jobs côté serveur) ── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as BatchItem[];
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.some(i => i.jobId)) {
        setItems(parsed);
        setOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* quota */
    }
  }, [items]);

  const parsedFromText = useMemo(() => {
    const list = rawUrls
      .split(/[\s\n]+/)
      .map(normalizeUrl)
      .filter((u): u is string => Boolean(u));
    return [...new Set(list)];
  }, [rawUrls]);

  const targets = mode === 'paste' ? parsedFromText.slice(0, MAX_URLS) : selected.slice(0, MAX_URLS);
  const overLimit = (mode === 'paste' ? parsedFromText.length : selected.length) > MAX_URLS;
  const totalCost = targets.length * CREDIT_COST;
  const completed = items.filter(i => i.status === 'completed');
  const allDone = items.length > 0 && items.every(i => i.status === 'completed' || i.status === 'failed');

  /* ── Découverte d'un répertoire via le sitemap ── */
  const handleDiscover = useCallback(async () => {
    const value = dirInput.trim();
    if (!value) {
      toast.error('Indiquez une URL de répertoire, par exemple https://exemple.fr/avis/');
      return;
    }
    const normalized = normalizeUrl(value);
    if (!normalized) {
      toast.error('URL invalide');
      return;
    }
    const parsedUrl = new URL(normalized);
    const prefix = parsedUrl.pathname.replace(/\/$/, '') || '/';

    setDiscovering(true);
    setDiscovered(null);
    setSelected([]);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-sitemap-tree', {
        body: { domain: parsedUrl.hostname },
      });
      if (error) throw error;
      const all = flattenTreeUrls(data?.tree || []);
      const matching = all.filter(u => {
        try {
          const p = new URL(u).pathname.replace(/\/$/, '');
          return prefix === '/' ? true : p === prefix || p.startsWith(`${prefix}/`);
        } catch {
          return false;
        }
      });
      setDiscovered(matching);
      setSelected(matching.slice(0, MAX_URLS));
      if (matching.length === 0) {
        toast.error(`Aucune URL trouvée sous ${prefix} dans le sitemap`);
      } else {
        toast.success(`${matching.length} URL(s) trouvée(s) sous ${prefix}`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Découverte impossible (sitemap inaccessible)');
    } finally {
      setDiscovering(false);
    }
  }, [dirInput]);

  const toggleSelected = (url: string) => {
    setSelected(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url);
      if (prev.length >= MAX_URLS) {
        toast.error(`Maximum ${MAX_URLS} URLs`);
        return prev;
      }
      return [...prev, url];
    });
  };

  /* ── Exécution : un job Marina par URL, 2 en parallèle ── */
  const runOne = useCallback(async (index: number, url: string): Promise<void> => {
    const setItem = (patch: Partial<BatchItem>) =>
      setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

    setItem({ status: 'running', progress: 0 });

    const debit = await useCredit(`Rapport Marina — ${url}`, CREDIT_COST);
    if (!debit.success) {
      setItem({ status: 'failed', error: debit.error || 'Crédits insuffisants' });
      return;
    }

    let jobId: string | null = null;
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marina`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, lang: language || 'fr' }),
      });
      const data = await res.json();
      if (data.error || !data.job_id) throw new Error(data.error || 'Lancement impossible');
      jobId = data.job_id;
      setItem({ jobId: data.job_id });
    } catch (e: any) {
      setItem({ status: 'failed', error: e?.message || 'Lancement impossible' });
      return;
    }

    // Polling — le job vit côté serveur, la fermeture de l'onglet ne l'interrompt pas.
    while (!cancelRef.current) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const session = (await supabase.auth.getSession()).data.session;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marina?job_id=${jobId}`,
          { headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
        const data = await res.json();
        if (data.status === 'completed') {
          setItem({ status: 'completed', progress: 100 });
          refreshCredits();
          return;
        }
        if (data.status === 'failed') {
          setItem({ status: 'failed', progress: 0, error: data.error || 'Échec de la génération' });
          return;
        }
        setItem({ progress: data.progress || 0 });
      } catch {
        /* réseau : on retente au tour suivant */
      }
    }
  }, [language, refreshCredits, useCredit]);

  const handleLaunch = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error('Connectez-vous pour lancer un rapport');
      return;
    }
    if (targets.length < 2) {
      toast.error('Indiquez au moins 2 URLs');
      return;
    }
    if (credits < totalCost) {
      toast.error(`Crédits insuffisants : ${totalCost} requis, ${credits} disponibles`);
      return;
    }

    cancelRef.current = false;
    setMergedHtml(null);
    const initial: BatchItem[] = targets.map(url => ({ url, status: 'pending', progress: 0 }));
    setItems(initial);
    setRunning(true);
    toast.success(`${targets.length} audits lancés — génération séquentielle en cours`);

    let cursor = 0;
    const worker = async () => {
      while (cursor < initial.length && !cancelRef.current) {
        const index = cursor++;
        await runOne(index, initial[index].url);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, initial.length) }, worker));
    setRunning(false);
  }, [credits, isAuthenticated, runOne, targets, totalCost]);

  const handleCancel = () => {
    cancelRef.current = true;
    setRunning(false);
    toast.info('Suivi interrompu — les audits déjà lancés continuent côté serveur');
  };

  /* ── Génération du PDF unique une fois tous les audits terminés ── */
  const handleBuildPdf = useCallback(async () => {
    setBuildingPdf(true);
    try {
      const parts: { url: string; html: string }[] = [];
      for (const item of items) {
        if (item.status !== 'completed' || !item.jobId) continue;
        const { data: job } = await supabase
          .from('async_jobs')
          .select('result_data')
          .eq('id', item.jobId)
          .maybeSingle();
        const result = job?.result_data as any;
        const viewUrl = result?.report_view_url || result?.report_url;
        if (!viewUrl) continue;
        const resp = await fetch(viewUrl);
        if (!resp.ok) continue;
        parts.push({ url: item.url, html: await resp.text() });
      }
      if (parts.length === 0) {
        toast.error('Aucun rapport récupérable');
        return;
      }
      setMergedHtml(mergeMarinaReports(parts));
      setShowModal(true);
    } catch (e: any) {
      toast.error(e?.message || 'Fusion impossible');
    } finally {
      setBuildingPdf(false);
    }
  }, [items]);

  const resetBatch = () => {
    cancelRef.current = true;
    setItems([]);
    setMergedHtml(null);
    setRunning(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const domainLabel = useMemo(() => {
    const first = items[0]?.url || targets[0];
    if (!first) return 'multipages';
    try {
      return new URL(first).hostname.replace(/^www\./, '');
    } catch {
      return 'multipages';
    }
  }, [items, targets]);

  return (
    <div className="mt-3">
      <div className="flex justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(o => !o)}
          className="h-10 gap-2 border-border bg-transparent hover:bg-muted/40"
        >
          <Layers className="w-4 h-4" />
          Multipages
          {items.length > 0 && (
            <Badge variant="outline" className="ml-1">{completed.length}/{items.length}</Badge>
          )}
        </Button>
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-border bg-card/60 p-4 text-left">
          {/* Sélecteur de mode */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMode('paste')}
              className={`bg-transparent ${mode === 'paste' ? 'border-primary text-primary' : 'border-border'}`}
            >
              Coller des URLs
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMode('directory')}
              className={`bg-transparent ${mode === 'directory' ? 'border-primary text-primary' : 'border-border'}`}
            >
              Auditer un répertoire
            </Button>
          </div>

          {mode === 'paste' ? (
            <>
              <Textarea
                value={rawUrls}
                onChange={e => setRawUrls(e.target.value)}
                rows={6}
                disabled={running}
                placeholder={'https://exemple.fr/avis/page-1\nhttps://exemple.fr/avis/page-2\nhttps://exemple.fr/tarifs'}
                className="bg-background border-border font-mono text-sm"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Une URL par ligne (ou séparées par des espaces). Maximum {MAX_URLS} URLs.
                Chaque URL donne lieu à un audit Marina complet, puis tous les audits sont réunis dans un seul PDF.
              </p>
            </>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={dirInput}
                  onChange={e => setDirInput(e.target.value)}
                  disabled={discovering || running}
                  placeholder="https://exemple.fr/avis/"
                  className="bg-background border-border"
                  onKeyDown={e => e.key === 'Enter' && handleDiscover()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDiscover}
                  disabled={discovering || running}
                  className="gap-2 bg-transparent border-border"
                >
                  {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSearch className="w-4 h-4" />}
                  Découvrir les pages
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Les URLs sont lues dans le sitemap du domaine puis filtrées sur le répertoire indiqué.
                Rien n'est lancé automatiquement : vous choisissez les pages à auditer (maximum {MAX_URLS}).
              </p>

              {discovered && discovered.length > 0 && (
                <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {discovered.map(u => {
                    const isSelected = selected.includes(u);
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => toggleSelected(u)}
                        disabled={running}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40 transition-colors"
                      >
                        <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${isSelected ? 'border-primary text-primary' : 'border-border'}`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </span>
                        <span className="truncate font-mono">{u}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Récapitulatif coût */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-muted-foreground">
              {targets.length} page(s) sélectionnée(s)
            </span>
            <span className="font-semibold">
              {totalCost} crédits ({CREDIT_COST} / page)
            </span>
            <span className="text-muted-foreground">
              Durée estimée : ~{Math.max(3, targets.length * 3)} min (audits exécutés l'un après l'autre)
            </span>

          </div>

          {overLimit && (
            <p className="mt-2 flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5" />
              Au-delà de {MAX_URLS} URLs, seules les {MAX_URLS} premières seront auditées.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleLaunch}
              disabled={running || targets.length < 2}
              className="gap-2 bg-transparent border-border"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              Lancer les {targets.length || ''} audits
            </Button>
            {running && (
              <Button type="button" variant="outline" onClick={handleCancel} className="gap-2 bg-transparent border-border">
                <X className="w-4 h-4" /> Arrêter le suivi
              </Button>
            )}
            {items.length > 0 && !running && (
              <Button type="button" variant="outline" onClick={resetBatch} className="gap-2 bg-transparent border-border">
                <X className="w-4 h-4" /> Réinitialiser
              </Button>
            )}
          </div>

          {/* Suivi par URL */}
          {items.length > 0 && (
            <div className="mt-5 space-y-2">
              {items.map((item, i) => (
                <div key={`${item.url}-${i}`} className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-mono">{item.url}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {item.status === 'pending' && 'En attente'}
                      {item.status === 'running' && `${item.progress}%`}
                      {item.status === 'completed' && 'Terminé'}
                      {item.status === 'failed' && (item.error || 'Échec')}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${item.status === 'failed' ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${item.status === 'completed' ? 100 : item.progress}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBuildPdf}
                  disabled={!allDone || completed.length === 0 || buildingPdf}
                  className="gap-2 bg-transparent border-border"
                >
                  {buildingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Générer le PDF combiné ({completed.length} audit{completed.length > 1 ? 's' : ''})
                </Button>
                {!allDone && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Le PDF n'est disponible qu'une fois tous les audits terminés. Les rapports sont
                    conservés côté serveur : vous pouvez fermer l'onglet et revenir plus tard.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {mergedHtml && (
        <MarinaReportPreviewModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          htmlContent={mergedHtml}
          domain={domainLabel}
        />
      )}
    </div>
  );
}
