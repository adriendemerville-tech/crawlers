import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Pencil, Trash2, Save, Shield, Brain, Eye, Award, RefreshCw, Settings2, FileText, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EeatReportPreview } from './EeatReportPreview';

interface EeatCriterion {
  id: string;
  criterion_key: string;
  label: string;
  category: string;
  scoring_method: string;
  weight: number;
  max_score: number;
  detection_config: Record<string, any>;
  description: string | null;
  is_active: boolean;
  display_order: number;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  experience: { label: 'Experience', icon: Eye, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  expertise: { label: 'Expertise', icon: Brain, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  authoritativeness: { label: 'Authoritativeness', icon: Award, color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  trustworthiness: { label: 'Trustworthiness', icon: Shield, color: 'bg-green-500/10 text-green-600 border-green-200' },
};

const METHOD_LABELS: Record<string, string> = {
  telemetry: '📡 Télémétrie',
  heuristic: '🔢 Heuristique',
  llm: '🤖 LLM',
};

const METHOD_TOOLTIPS: Record<string, string> = {
  telemetry: 'Données mesurées automatiquement par crawl HTML (balises, Schema.org, liens, signaux de fraîcheur). Aucune IA impliquée.',
  heuristic: 'Score calculé par des règles pondérées à partir de signaux bruts (ex: présence d\'auteur + page à propos = +20 pts).',
  llm: 'Analyse sémantique par IA (originalité, pertinence, qualité rédactionnelle). Coûte des crédits.',
};

const CATEGORY_TOOLTIPS: Record<string, string> = {
  experience: 'Preuves que l\'auteur a vécu ou pratiqué ce dont il parle (témoignages, cas concrets, captures).',
  expertise: 'Qualifications, profondeur technique et précision du contenu sur le sujet traité.',
  authoritativeness: 'Reconnaissance externe : backlinks, citations, mentions par des sources faisant autorité.',
  trustworthiness: 'Signaux de confiance : HTTPS, mentions légales, contact, politique de confidentialité, avis vérifiés.',
};

export function EeatScoringAdmin() {
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<EeatCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanUrl, setScanUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<EeatCriterion | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('config');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCriterion, setNewCriterion] = useState({
    criterion_key: '',
    label: '',
    category: 'experience',
    scoring_method: 'telemetry',
    weight: 1.0,
    max_score: 100,
    description: '',
    detection_config: '{}',
  });

  const fetchCriteria = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('eeat_scoring_criteria')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setCriteria((data as unknown as EeatCriterion[]) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchCriteria(); }, [fetchCriteria]);

  const handleScan = async () => {
    if (!scanUrl.trim()) return;
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-eeat', {
        body: { url: scanUrl.trim() },
      });
      if (error) throw error;
      toast({ title: 'Scan E-E-A-T terminé', description: `Score global : ${data?.score ?? '?'}/100` });
      console.log('[EEAT Scan Result]', data);
      if (data?.success) {
        setScanResult({
          url: scanUrl.trim(),
          score: data.score,
          experience: data.experience,
          expertise: data.expertise,
          authoritativeness: data.authoritativeness,
          trustworthiness: data.trustworthiness,
          signals: data.signals,
          trustSignals: data.trustSignals || [],
          missingSignals: data.missingSignals || [],
          issues: data.issues || [],
          scannedAt: new Date().toISOString(),
        });
        setActiveTab('report');
      }
    } catch (e: any) {
      toast({ title: 'Erreur scan', description: e.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const handleToggleActive = async (criterion: EeatCriterion) => {
    const { error } = await supabase
      .from('eeat_scoring_criteria')
      .update({ is_active: !criterion.is_active } as any)
      .eq('id', criterion.id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setCriteria(prev => prev.map(c => c.id === criterion.id ? { ...c, is_active: !c.is_active } : c));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce critère ?')) return;
    const { error } = await supabase.from('eeat_scoring_criteria').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setCriteria(prev => prev.filter(c => c.id !== id));
      toast({ title: 'Critère supprimé' });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCriterion) return;
    const { id, created_at, updated_at, ...rest } = editingCriterion as any;
    const { error } = await supabase
      .from('eeat_scoring_criteria')
      .update(rest as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setCriteria(prev => prev.map(c => c.id === id ? editingCriterion : c));
      setEditingCriterion(null);
      toast({ title: 'Critère mis à jour' });
    }
  };

  const handleAdd = async () => {
    let parsedConfig: Record<string, any>;
    try {
      parsedConfig = JSON.parse(newCriterion.detection_config);
    } catch {
      toast({ title: 'JSON invalide', description: 'detection_config doit être du JSON valide', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('eeat_scoring_criteria').insert({
      criterion_key: newCriterion.criterion_key,
      label: newCriterion.label,
      category: newCriterion.category,
      scoring_method: newCriterion.scoring_method,
      weight: newCriterion.weight,
      max_score: newCriterion.max_score,
      description: newCriterion.description || null,
      detection_config: parsedConfig,
      display_order: criteria.length + 1,
    } as any);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      setShowAddDialog(false);
      setNewCriterion({ criterion_key: '', label: '', category: 'experience', scoring_method: 'telemetry', weight: 1.0, max_score: 100, description: '', detection_config: '{}' });
      fetchCriteria();
      toast({ title: 'Critère ajouté' });
    }
  };

  const groupedCriteria = criteria.reduce<Record<string, EeatCriterion[]>>((acc, c) => {
    (acc[c.category] = acc[c.category] || []).push(c);
    return acc;
  }, {});

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="config" className="gap-2"><Settings2 className="h-4 w-4" /> Configuration</TabsTrigger>
        <TabsTrigger value="report" className="gap-2" disabled={!scanResult}><FileText className="h-4 w-4" /> Rapport</TabsTrigger>
      </TabsList>

      <TabsContent value="config">
      <div className="space-y-6">
      {/* Scan Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Scan E-E-A-T
          </CardTitle>
          <CardDescription>Lancer un diagnostic E-E-A-T sur une URL cible</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com/page"
              value={scanUrl}
              onChange={e => setScanUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleScan()}
            />
            <Button onClick={handleScan} disabled={scanning || !scanUrl.trim()}>
              {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Criteria Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Paramètres de scoring E-E-A-T
            </CardTitle>
            <CardDescription>{criteria.length} critères configurés · {criteria.filter(c => c.is_active).length} actifs</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
            const items = groupedCriteria[catKey] || [];
            const CatIcon = meta.icon;
            return (
              <div key={catKey} className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CatIcon className="h-4 w-4" />
                  {meta.label}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground transition-colors"><HelpCircle className="h-3.5 w-3.5" /></button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-xs">{CATEGORY_TOOLTIPS[catKey]}</TooltipContent>
                  </Tooltip>
                  <Badge variant="outline" className="text-xs">{items.length}</Badge>
                </h3>
                <div className="space-y-1">
                  {items.map(c => (
                    <div key={c.id} className={`flex items-center gap-3 p-2 rounded-md border text-sm ${c.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'}`}>
                      <Switch checked={c.is_active} onCheckedChange={() => handleToggleActive(c)} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.description}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs shrink-0">{METHOD_LABELS[c.scoring_method]}</Badge>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground hover:text-foreground transition-colors"><HelpCircle className="h-3 w-3" /></button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">{METHOD_TOOLTIPS[c.scoring_method]}</TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">×{c.weight}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCriterion({ ...c })}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-muted-foreground italic pl-6">Aucun critère</p>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingCriterion} onOpenChange={open => !open && setEditingCriterion(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le critère</DialogTitle>
          </DialogHeader>
          {editingCriterion && (
            <div className="space-y-3">
              <div><Label>Label</Label><Input value={editingCriterion.label} onChange={e => setEditingCriterion({ ...editingCriterion, label: e.target.value })} /></div>
              <div><Label>Clé</Label><Input value={editingCriterion.criterion_key} onChange={e => setEditingCriterion({ ...editingCriterion, criterion_key: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Catégorie</Label>
                  <Select value={editingCriterion.category} onValueChange={v => setEditingCriterion({ ...editingCriterion, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Méthode</Label>
                  <Select value={editingCriterion.scoring_method} onValueChange={v => setEditingCriterion({ ...editingCriterion, scoring_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telemetry">Télémétrie</SelectItem>
                      <SelectItem value="heuristic">Heuristique</SelectItem>
                      <SelectItem value="llm">LLM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Poids</Label><Input type="number" step="0.1" value={editingCriterion.weight} onChange={e => setEditingCriterion({ ...editingCriterion, weight: parseFloat(e.target.value) || 1 })} /></div>
                <div><Label>Score max</Label><Input type="number" value={editingCriterion.max_score} onChange={e => setEditingCriterion({ ...editingCriterion, max_score: parseInt(e.target.value) || 100 })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={editingCriterion.description || ''} onChange={e => setEditingCriterion({ ...editingCriterion, description: e.target.value })} /></div>
              <div><Label>Config de détection (JSON)</Label><Textarea className="font-mono text-xs" rows={4} value={JSON.stringify(editingCriterion.detection_config, null, 2)} onChange={e => { try { setEditingCriterion({ ...editingCriterion, detection_config: JSON.parse(e.target.value) }); } catch {} }} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCriterion(null)}>Annuler</Button>
            <Button onClick={handleSaveEdit}><Save className="h-4 w-4" /> Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau critère E-E-A-T</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Clé unique</Label><Input placeholder="mon_critere" value={newCriterion.criterion_key} onChange={e => setNewCriterion({ ...newCriterion, criterion_key: e.target.value })} /></div>
            <div><Label>Label</Label><Input placeholder="Mon critère" value={newCriterion.label} onChange={e => setNewCriterion({ ...newCriterion, label: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Catégorie</Label>
                <Select value={newCriterion.category} onValueChange={v => setNewCriterion({ ...newCriterion, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Méthode</Label>
                <Select value={newCriterion.scoring_method} onValueChange={v => setNewCriterion({ ...newCriterion, scoring_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telemetry">Télémétrie</SelectItem>
                    <SelectItem value="heuristic">Heuristique</SelectItem>
                    <SelectItem value="llm">LLM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Poids</Label><Input type="number" step="0.1" value={newCriterion.weight} onChange={e => setNewCriterion({ ...newCriterion, weight: parseFloat(e.target.value) || 1 })} /></div>
              <div><Label>Score max</Label><Input type="number" value={newCriterion.max_score} onChange={e => setNewCriterion({ ...newCriterion, max_score: parseInt(e.target.value) || 100 })} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={newCriterion.description} onChange={e => setNewCriterion({ ...newCriterion, description: e.target.value })} /></div>
            <div><Label>Config de détection (JSON)</Label><Textarea className="font-mono text-xs" rows={3} value={newCriterion.detection_config} onChange={e => setNewCriterion({ ...newCriterion, detection_config: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!newCriterion.criterion_key || !newCriterion.label}><Plus className="h-4 w-4" /> Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
      </TabsContent>

      <TabsContent value="report">
        {scanResult ? (
          <EeatReportPreview result={scanResult} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Lancez un scan E-E-A-T pour générer un rapport.
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
