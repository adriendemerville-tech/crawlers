import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bot, Scan, Bug, Brain, Wand2, FileText, Zap, RotateCcw, Play, Pause, Trash2, Plus, ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AutopilotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedSiteId: string;
  siteDomain: string;
}

type ImplMode = 'dry_run' | 'one_shot' | 'one_shot_feedback' | 'auto';

const IMPL_MODES: { value: ImplMode; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'dry_run', label: 'Dry-run (simulation)', desc: 'Simule sans modifier le site', icon: Scan },
  { value: 'one_shot', label: 'One shot', desc: 'Exécute une seule fois', icon: Zap },
  { value: 'one_shot_feedback', label: 'One shot + rétroaction', desc: 'Exécute → vérifie → corrige', icon: RotateCcw },
  { value: 'auto', label: 'Automatique', desc: 'Boucle jusqu\'à l\'arrêt (cooldown 48h)', icon: Play },
];

export function AutopilotModal({ open, onOpenChange, trackedSiteId, siteDomain }: AutopilotModalProps) {
  const { user } = useAuth();

  // Diagnostic
  const [diagAudit, setDiagAudit] = useState(true);
  const [diagCrawl, setDiagCrawl] = useState(true);
  const [diagStratege, setDiagStratege] = useState(false);

  // Prescription
  const [prescStratege, setPrescStratege] = useState(true);
  const [prescArchitect, setPrescArchitect] = useState(true);
  const [prescContent, setPrescContent] = useState(false);

  // Implementation
  const [implMode, setImplMode] = useState<ImplMode>('dry_run');

  // Guardrails
  const [maxPages, setMaxPages] = useState(10);
  const [autoPause, setAutoPause] = useState(true);
  const [pauseThreshold, setPauseThreshold] = useState(15);
  const [excludedSubdomains, setExcludedSubdomains] = useState<string[]>([]);
  const [excludedPageTypes, setExcludedPageTypes] = useState<string[]>([]);
  const [newExclusion, setNewExclusion] = useState('');
  const [newPageType, setNewPageType] = useState('');

  // State
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string>('idle');

  const handleToggleActive = async () => {
    if (!configId || !user) return;
    setToggling(true);
    try {
      const newActive = !isActive;
      const newStatus = newActive ? 'running' : 'idle';
      const { error } = await supabase
        .from('autopilot_configs')
        .update({ is_active: newActive, status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', configId);
      if (error) throw error;
      setIsActive(newActive);
      setStatus(newStatus);
      toast.success(newActive ? 'Autopilote activé' : 'Autopilote désactivé');
    } catch {
      toast.error('Erreur lors du changement de statut');
    } finally {
      setToggling(false);
    }
  };

  // Load existing config
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from('autopilot_configs')
        .select('*')
        .eq('tracked_site_id', trackedSiteId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setConfigId(data.id);
        setIsActive(data.is_active ?? false);
        setStatus(data.status ?? 'idle');
        setDiagAudit(data.diag_audit_complet ?? true);
        setDiagCrawl(data.diag_crawl ?? true);
        setDiagStratege(data.diag_stratege_cocoon ?? false);
        setPrescStratege(data.presc_stratege_cocoon ?? true);
        setPrescArchitect(data.presc_architect ?? true);
        setPrescContent(data.presc_content_architect ?? false);
        setImplMode((data.implementation_mode as ImplMode) ?? 'dry_run');
        setMaxPages(data.max_pages_per_cycle ?? 10);
        setPauseThreshold(Number(data.auto_pause_threshold) ?? 15);
        setAutoPause(Number(data.auto_pause_threshold) > 0);
        setExcludedSubdomains(data.excluded_subdomains ?? []);
        setExcludedPageTypes(data.excluded_page_types ?? []);
      }
    })();
  }, [open, user, trackedSiteId]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        tracked_site_id: trackedSiteId,
        is_active: isActive,
        diag_audit_complet: diagAudit,
        diag_crawl: diagCrawl,
        diag_stratege_cocoon: diagStratege,
        presc_stratege_cocoon: prescStratege,
        presc_architect: prescArchitect,
        presc_content_architect: prescContent,
        implementation_mode: implMode,
        max_pages_per_cycle: maxPages,
        cooldown_hours: 48,
        auto_pause_threshold: autoPause ? pauseThreshold : 0,
        excluded_subdomains: excludedSubdomains,
        excluded_page_types: excludedPageTypes,
        updated_at: new Date().toISOString(),
      };

      if (configId) {
        await supabase.from('autopilot_configs').update(payload).eq('id', configId);
      } else {
        const { data } = await supabase.from('autopilot_configs').insert(payload).select('id').single();
        if (data) setConfigId(data.id);
      }
      toast.success('Configuration Autopilote sauvegardée');
      onOpenChange(false);
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const addExclusion = (type: 'subdomain' | 'pagetype') => {
    if (type === 'subdomain' && newExclusion.trim()) {
      setExcludedSubdomains(prev => [...prev, newExclusion.trim()]);
      setNewExclusion('');
    } else if (type === 'pagetype' && newPageType.trim()) {
      setExcludedPageTypes(prev => [...prev, newPageType.trim()]);
      setNewPageType('');
    }
  };

  // Pipeline visual summary
  const pipelineSteps: string[] = [];
  if (diagAudit) pipelineSteps.push('Audit');
  if (diagCrawl) pipelineSteps.push('Crawl');
  if (diagStratege) pipelineSteps.push('Diag Stratège');
  if (prescStratege) pipelineSteps.push('Stratège');
  if (prescArchitect) pipelineSteps.push('Architect');
  if (prescContent) pipelineSteps.push('Content');
  const implLabel = IMPL_MODES.find(m => m.value === implMode)?.label ?? '';
  pipelineSteps.push(implLabel);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Autopilote — {siteDomain.replace(/^www\./, '')}
          </DialogTitle>
          <DialogDescription>
            Pipeline d'automation SEO. Configure les phases puis lance le cycle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── DIAGNOSTIC ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Diagnostic</h3>
            <div className="space-y-2">
              <CheckOption checked={diagAudit} onChange={setDiagAudit} icon={Scan} label="Audit complet" desc="SEO + Performance + GEO + LLM" />
              <CheckOption checked={diagCrawl} onChange={setDiagCrawl} icon={Bug} label="Crawl" desc="Crawl technique du site" />
              <CheckOption checked={diagStratege} onChange={setDiagStratege} icon={Brain} label="Stratège Cocoon" desc="Analyse du maillage interne" />
            </div>
          </section>

          <Separator />

          {/* ── PRESCRIPTION ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Prescription</h3>
            <div className="space-y-2">
              <CheckOption checked={prescStratege} onChange={setPrescStratege} icon={Brain} label="Stratège Cocoon" desc="Recommandations maillage" />
              <CheckOption checked={prescArchitect} onChange={setPrescArchitect} icon={Wand2} label="Architect" desc="Génération de code correctif" />
              <CheckOption checked={prescContent} onChange={setPrescContent} icon={FileText} label="Content Architect" desc="Optimisation du contenu éditorial" />
            </div>
          </section>

          <Separator />

          {/* ── IMPLEMENTATION ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Implémentation</h3>
            <div className="space-y-2">
              {IMPL_MODES.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setImplMode(mode.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                    implMode === mode.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    implMode === mode.value ? 'border-primary' : 'border-muted-foreground/40'
                  }`}>
                    {implMode === mode.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <mode.icon className={`h-4 w-4 shrink-0 ${implMode === mode.value ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">{mode.label}</p>
                    <p className="text-xs text-muted-foreground">{mode.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <Separator />

          {/* ── GARDE-FOUS ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Garde-fous
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-sm shrink-0">Max pages/cycle</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={maxPages}
                  onChange={e => setMaxPages(Number(e.target.value))}
                  className="w-20 h-8 text-sm"
                />
              </div>

              <div className="flex items-center gap-3">
                <Checkbox checked={autoPause} onCheckedChange={v => setAutoPause(!!v)} id="auto-pause" />
                <Label htmlFor="auto-pause" className="text-sm">Auto-pause si chute &gt;</Label>
                <Input
                  type="number"
                  min={5}
                  max={50}
                  value={pauseThreshold}
                  onChange={e => setPauseThreshold(Number(e.target.value))}
                  className="w-16 h-8 text-sm"
                  disabled={!autoPause}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>

              <div className="text-xs text-muted-foreground">Cooldown entre cycles : <strong>48h</strong></div>

              {/* Excluded subdomains */}
              <div>
                <Label className="text-xs text-muted-foreground">Exclusions sous-domaines</Label>
                <div className="flex gap-1.5 mt-1">
                  <Input
                    placeholder="blog.example.com"
                    value={newExclusion}
                    onChange={e => setNewExclusion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addExclusion('subdomain')}
                    className="h-8 text-sm flex-1"
                  />
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => addExclusion('subdomain')}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {excludedSubdomains.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {excludedSubdomains.map((s, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 text-xs">
                        {s}
                        <button onClick={() => setExcludedSubdomains(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Excluded page types */}
              <div>
                <Label className="text-xs text-muted-foreground">Exclusions types de pages</Label>
                <div className="flex gap-1.5 mt-1">
                  <Input
                    placeholder="produit, catégorie..."
                    value={newPageType}
                    onChange={e => setNewPageType(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addExclusion('pagetype')}
                    className="h-8 text-sm flex-1"
                  />
                  <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => addExclusion('pagetype')}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {excludedPageTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {excludedPageTypes.map((s, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 text-xs">
                        {s}
                        <button onClick={() => setExcludedPageTypes(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <Separator />

          {/* ── PIPELINE VISUAL ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pipeline</h3>
            <div className="flex items-center flex-wrap gap-1">
              {pipelineSteps.map((step, i) => (
                <span key={i} className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs font-medium">{step}</Badge>
                  {i < pipelineSteps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                </span>
              ))}
            </div>
          </section>

          {/* ── ACTIONS ── */}
          <div className="flex items-center gap-2 pt-2">
            {configId && (
              <Button
                variant={isActive ? 'destructive' : 'default'}
                size="sm"
                disabled={toggling}
                onClick={handleToggleActive}
                className={`gap-1.5 transition-all duration-500 ${
                  isActive
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400 animate-autopilot-glow'
                    : ''
                }`}
              >
                {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isActive ? 'Désactiver' : 'Activer'}
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Sauvegarder
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Reusable checkbox option
function CheckOption({ checked, onChange, icon: Icon, label, desc }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ElementType;
  label: string;
  desc: string;
}) {
  return (
    <label className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
      checked ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-muted-foreground/30'
    }`}>
      <Checkbox checked={checked} onCheckedChange={v => onChange(!!v)} />
      <Icon className={`h-4 w-4 shrink-0 ${checked ? 'text-primary' : 'text-muted-foreground'}`} />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </label>
  );
}
