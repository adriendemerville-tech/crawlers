import { useState, useEffect, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FolderTree, Globe, ChevronRight, ChevronDown, FileText, AlertCircle, Sparkles, Save, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface FolderNode {
  path: string;
  label: string;
  count: number;
  children: FolderNode[];
  urls: string[];
}

interface RuleAssignment {
  urlPattern: string;
  payloadType: string;
  payloadData: Record<string, unknown>;
}

const PAYLOAD_TYPES = [
  { value: 'GLOBAL_FIXES', label: 'Correctifs globaux' },
  { value: 'FAQPage', label: 'FAQ (JSON-LD)' },
  { value: 'Article', label: 'Article (JSON-LD)' },
  { value: 'Organization', label: 'Organization (JSON-LD)' },
  { value: 'LocalBusiness', label: 'LocalBusiness (JSON-LD)' },
  { value: 'BreadcrumbList', label: 'Breadcrumbs (JSON-LD)' },
  { value: 'Product', label: 'Product (JSON-LD)' },
  { value: 'HTML_INJECTION', label: 'Injection HTML' },
];

const translations = {
  fr: {
    title: 'Routeur Multi-Pages',
    subtitle: 'Assignez des correctifs par section de votre site',
    loading: 'Chargement de l\'arborescence...',
    noSitemap: 'Aucun sitemap trouvé. Utilisez le mode manuel ci-dessous.',
    manualLabel: 'Règle manuelle (URL pattern)',
    manualPlaceholder: '/blog/*, /contact, GLOBAL',
    addRule: 'Ajouter la règle',
    saveAll: 'Sauvegarder & Déployer',
    saving: 'Sauvegarde...',
    saved: 'Règles sauvegardées et déployées',
    assignType: 'Type de correctif',
    pages: 'pages',
    proOnly: 'Fonctionnalité réservée aux abonnés Pro',
    folderAssign: 'Assigner',
    globalRule: 'Règle globale (toutes les pages)',
    refresh: 'Rafraîchir',
    totalUrls: 'URLs détectées',
    cached: 'Données en cache',
    rules: 'règles actives',
    version: 'v',
    restore: 'Restaurer la version précédente',
    restored: 'Version précédente restaurée',
    noHistory: 'Aucune version précédente disponible',
  },
  en: {
    title: 'Multi-Page Router',
    subtitle: 'Assign fixes by section of your site',
    loading: 'Loading site tree...',
    noSitemap: 'No sitemap found. Use manual mode below.',
    manualLabel: 'Manual rule (URL pattern)',
    manualPlaceholder: '/blog/*, /contact, GLOBAL',
    addRule: 'Add rule',
    saveAll: 'Save & Deploy',
    saving: 'Saving...',
    saved: 'Rules saved and deployed',
    assignType: 'Fix type',
    pages: 'pages',
    proOnly: 'Feature reserved for Pro subscribers',
    folderAssign: 'Assign',
    globalRule: 'Global rule (all pages)',
    refresh: 'Refresh',
    totalUrls: 'URLs detected',
    cached: 'Cached data',
    rules: 'active rules',
    version: 'v',
    restore: 'Restore previous version',
    restored: 'Previous version restored',
    noHistory: 'No previous version available',
  },
  es: {
    title: 'Router Multi-Páginas',
    subtitle: 'Asigne correctivos por sección de su sitio',
    loading: 'Cargando árbol del sitio...',
    noSitemap: 'No se encontró sitemap. Use el modo manual abajo.',
    manualLabel: 'Regla manual (patrón URL)',
    manualPlaceholder: '/blog/*, /contacto, GLOBAL',
    addRule: 'Agregar regla',
    saveAll: 'Guardar y Desplegar',
    saving: 'Guardando...',
    saved: 'Reglas guardadas y desplegadas',
    assignType: 'Tipo de correctivo',
    pages: 'páginas',
    proOnly: 'Funcionalidad reservada a suscriptores Pro',
    folderAssign: 'Asignar',
    globalRule: 'Regla global (todas las páginas)',
    refresh: 'Refrescar',
    totalUrls: 'URLs detectadas',
    cached: 'Datos en caché',
    rules: 'reglas activas',
    version: 'v',
    restore: 'Restaurar versión anterior',
    restored: 'Versión anterior restaurada',
    noHistory: 'No hay versión anterior disponible',
  },
};

interface MultiPageRouterProps {
  domain: string;
  siteId: string | null;
}

export function MultiPageRouter({ domain, siteId }: MultiPageRouterProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAgencyPro } = useCredits();
  const { isAdmin } = useAdmin();

  const [tree, setTree] = useState<FolderNode[]>([]);
  const [totalUrls, setTotalUrls] = useState(0);
  const [isCached, setIsCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<RuleAssignment[]>([]);
  const [manualPattern, setManualPattern] = useState('');
  const [manualType, setManualType] = useState('GLOBAL_FIXES');
  const [saving, setSaving] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [rulesWithVersion, setRulesWithVersion] = useState<Array<{ id: string; version: number; hasPrevious: boolean }>>([]);

  // Fetch the sitemap tree
  const fetchTree = useCallback(async () => {
    if (!domain) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-sitemap-tree', {
        body: { domain },
      });
      if (error) throw error;
      setTree(data?.tree || []);
      setTotalUrls(data?.totalUrls || 0);
      setIsCached(data?.cached || false);
    } catch (err) {
      console.error('[MultiPageRouter] Error fetching tree:', err);
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, [domain]);

  // Fetch existing rules
  const fetchExistingRules = useCallback(async () => {
    if (!siteId || !user) return;
    try {
      const { data } = await supabase
        .from('site_script_rules')
        .select('id, url_pattern, payload_type, payload_data, is_active, version, previous_payload_data')
        .eq('domain_id', siteId)
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (data) {
        setAssignments(data.map(r => ({
          urlPattern: r.url_pattern,
          payloadType: r.payload_type,
          payloadData: (r.payload_data as Record<string, unknown>) || {},
        })));
        setRulesWithVersion(data.map(r => ({
          id: r.id as string,
          version: (r as any).version ?? 1,
          hasPrevious: !!(r as any).previous_payload_data,
        })));
      }
    } catch (err) {
      console.error('[MultiPageRouter] Error fetching rules:', err);
    }
  }, [siteId, user]);

  // Restore a rule to its previous version
  const handleRestore = async (index: number) => {
    const meta = rulesWithVersion[index];
    if (!meta?.hasPrevious || !meta.id) {
      toast({ title: t.noHistory, variant: 'destructive' });
      return;
    }

    try {
      // Fetch the rule with previous_payload_data
      const { data: rule } = await supabase
        .from('site_script_rules')
        .select('previous_payload_data')
        .eq('id', meta.id)
        .single();

      if (!rule?.previous_payload_data) {
        toast({ title: t.noHistory, variant: 'destructive' });
        return;
      }

      // Update: set payload_data = previous_payload_data (trigger will auto-archive current)
      const { error } = await supabase
        .from('site_script_rules')
        .update({ payload_data: rule.previous_payload_data as any })
        .eq('id', meta.id);

      if (error) throw error;

      toast({ title: t.restored });
      fetchExistingRules();
    } catch (err) {
      console.error('[MultiPageRouter] Restore error:', err);
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchTree();
    fetchExistingRules();
  }, [fetchTree, fetchExistingRules]);

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // Assign a fix type to a folder path
  const assignToPath = (path: string, payloadType: string) => {
    const pattern = path === '/' ? 'GLOBAL' : `${path}/*`;
    setAssignments(prev => {
      const existing = prev.findIndex(a => a.urlPattern === pattern);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], payloadType };
        return updated;
      }
      return [...prev, { urlPattern: pattern, payloadType, payloadData: {} }];
    });
  };

  // Add manual rule
  const addManualRule = () => {
    if (!manualPattern.trim()) return;
    const pattern = manualPattern.trim();
    if (assignments.some(a => a.urlPattern === pattern)) return;
    setAssignments(prev => [...prev, { urlPattern: pattern, payloadType: manualType, payloadData: {} }]);
    setManualPattern('');
  };

  // Remove assignment
  const removeAssignment = (index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index));
  };

  // Payload types that need AI generation (queued)
  const AI_GENERATED_TYPES = ['FAQPage', 'HTML_INJECTION', 'Article'];

  // Resolve dominant intent for a URL pattern from semantic_nodes
  const resolveIntentForPattern = async (pattern: string): Promise<string> => {
    if (!siteId || !user) return 'informational';
    try {
      // Match semantic_nodes URLs against the pattern
      let query = supabase
        .from('semantic_nodes' as any)
        .select('intent')
        .eq('tracked_site_id', siteId)
        .eq('user_id', user.id)
        .limit(50);

      // For patterns like /blog/*, filter URLs containing /blog/
      const pathPrefix = pattern.replace('/*', '').replace('GLOBAL', '');
      if (pathPrefix && pathPrefix !== '/') {
        query = query.ilike('url', `%${pathPrefix}%`);
      }

      const { data: nodes } = await query;
      if (!nodes || nodes.length === 0) return 'informational';

      // Count intents and return dominant
      const counts: Record<string, number> = {};
      for (const n of nodes as any[]) {
        const intent = n.intent || 'informational';
        counts[intent] = (counts[intent] || 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    } catch {
      return 'informational';
    }
  };

  // Save all rules via bulk upsert with queuing for AI-generated payloads
  const handleSaveAll = async () => {
    if (!siteId || !user) return;
    setSaving(true);
    try {
      // ── Ownership verification before injection ──
      const { data: siteOwnership } = await supabase
        .from('tracked_sites')
        .select('id, user_id')
        .eq('id', siteId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!siteOwnership) {
        toast({ title: 'Accès refusé', description: 'Vous n\'êtes pas propriétaire de ce site', variant: 'destructive' });
        setSaving(false);
        return;
      }
      // Resolve intents for all assignments in parallel
      const intents = await Promise.all(
        assignments.map(a => resolveIntentForPattern(a.urlPattern))
      );

      // Delete existing rules for this site
      await supabase
        .from('site_script_rules')
        .delete()
        .eq('domain_id', siteId)
        .eq('user_id', user.id);

      // Insert new rules with appropriate generation_status + intent
      if (assignments.length > 0) {
        const rows = assignments.map((a, idx) => {
          const needsAI = AI_GENERATED_TYPES.includes(a.payloadType) && 
            (!a.payloadData || Object.keys(a.payloadData).length <= 1);
          return {
            domain_id: siteId,
            user_id: user.id,
            url_pattern: a.urlPattern,
            payload_type: a.payloadType,
            payload_data: { ...a.payloadData, _intent: intents[idx] } as any,
            is_active: true,
            status: 'active',
            generation_status: needsAI ? 'pending' : 'ready',
            queued_at: needsAI ? new Date().toISOString() : null,
          };
        });

        const { error } = await supabase
          .from('site_script_rules')
          .insert(rows as any);

        if (error) throw error;

        // If any rules need AI generation, trigger the queue worker
        const hasAIRules = rows.some(r => r.generation_status === 'pending');
        if (hasAIRules) {
          supabase.functions.invoke('process-script-queue', {
            body: { domain_id: siteId },
          }).catch(() => {});
          toast({ title: t.saved, description: `${rows.filter(r => r.generation_status === 'pending').length} règles en file d'attente pour génération IA` });
        } else {
          toast({ title: t.saved });
        }
      } else {
        toast({ title: t.saved });
      }
    } catch (err) {
      console.error('[MultiPageRouter] Save error:', err);
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Render folder tree recursively
  const renderFolder = (node: FolderNode, depth = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const hasChildren = node.children.length > 0;
    const currentAssignment = assignments.find(a => 
      a.urlPattern === `${node.path}/*` || (node.path === '/' && a.urlPattern === 'GLOBAL')
    );

    return (
      <div key={node.path} style={{ paddingLeft: `${depth * 16}px` }}>
        <div className="flex items-center gap-2 py-1.5 hover:bg-muted/50 rounded px-2 group">
          {/* Expand/collapse */}
          <button
            onClick={() => hasChildren && toggleFolder(node.path)}
            className="w-4 h-4 flex items-center justify-center flex-shrink-0"
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            ) : (
              <FileText className="w-3 h-3 text-muted-foreground" />
            )}
          </button>

          {/* Folder icon + label */}
          {hasChildren && <FolderTree className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
          <span className="text-xs font-medium truncate flex-1">{node.label}</span>

          {/* Page count */}
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
            {node.count} {t.pages}
          </Badge>

          {/* Assignment selector */}
          <Select
            value={currentAssignment?.payloadType || ''}
            onValueChange={(val) => assignToPath(node.path, val)}
          >
            <SelectTrigger className="h-6 w-[130px] text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
              <SelectValue placeholder={t.folderAssign} />
            </SelectTrigger>
            <SelectContent>
              {PAYLOAD_TYPES.map(pt => (
                <SelectItem key={pt.value} value={pt.value} className="text-xs">
                  {pt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && node.children.map(child => renderFolder(child, depth + 1))}
      </div>
    );
  };

  // Pro gate
  if (!isAgencyPro && !isAdmin) {
    return (
      <div className="p-4 text-center space-y-2">
        <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
        <p className="text-sm font-medium">{t.proOnly}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-violet-500" />
            {t.title}
          </h4>
          <p className="text-[11px] text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {totalUrls > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {totalUrls} {t.totalUrls}
              {isCached && <span className="ml-1 text-muted-foreground">({t.cached})</span>}
            </Badge>
          )}
          {assignments.length > 0 && (
            <Badge className="text-[10px] bg-violet-500">
              {assignments.length} {t.rules}
            </Badge>
          )}
        </div>
      </div>

      {/* Folder tree */}
      {loading ? (
        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">{t.loading}</span>
        </div>
      ) : tree.length > 0 ? (
        <ScrollArea className="h-[200px] border rounded-md p-1">
          {tree.map(node => renderFolder(node))}
        </ScrollArea>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-400">{t.noSitemap}</span>
        </div>
      )}

      <Separator />

      {/* Manual rule fallback */}
      <div className="space-y-2">
        <label className="text-xs font-medium">{t.manualLabel}</label>
        <div className="flex gap-2">
          <Input
            value={manualPattern}
            onChange={e => setManualPattern(e.target.value)}
            placeholder={t.manualPlaceholder}
            className="h-7 text-xs flex-1"
            onKeyDown={e => e.key === 'Enter' && addManualRule()}
          />
          <Select value={manualType} onValueChange={setManualType}>
            <SelectTrigger className="h-7 w-[140px] text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYLOAD_TYPES.map(pt => (
                <SelectItem key={pt.value} value={pt.value} className="text-xs">
                  {pt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={addManualRule} className="h-7 text-xs px-2">
            {t.addRule}
          </Button>
        </div>
      </div>

      {/* Active assignments list */}
      {assignments.length > 0 && (
        <div className="space-y-1">
          {assignments.map((a, i) => {
            const meta = rulesWithVersion[i];
            return (
              <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
                <Badge variant="outline" className="text-[9px] font-mono">{a.urlPattern}</Badge>
                <span className="text-muted-foreground">→</span>
                <Badge className="text-[9px]">{PAYLOAD_TYPES.find(p => p.value === a.payloadType)?.label || a.payloadType}</Badge>
                {meta?.version > 1 && (
                  <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{t.version}{meta.version}</Badge>
                )}
                {meta?.hasPrevious && (
                  <button
                    onClick={() => handleRestore(i)}
                    className="text-muted-foreground hover:text-primary"
                    title={t.restore}
                  >
                    <Undo2 className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => removeAssignment(i)}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Save button */}
      <Button
        onClick={handleSaveAll}
        disabled={saving || assignments.length === 0}
        className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
        size="sm"
      >
        {saving ? (
          <><Loader2 className="w-3 h-3 animate-spin" />{t.saving}</>
        ) : (
          <><Save className="w-3 h-3" />{t.saveAll}</>
        )}
      </Button>
    </div>
  );
}
