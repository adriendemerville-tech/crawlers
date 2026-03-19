import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Eye, BarChart3, Edit2, Copy, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface ContentBlock {
  id: string;
  type: 'poll' | 'rating' | 'text_feedback' | 'screenshot' | 'share';
  question?: string;
  options?: string[];
  max_rating?: number;
  share_channel?: 'whatsapp' | 'sms';
  share_message?: string;
  label?: string;
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: string;
  target_pages: string[];
  target_persona: Record<string, any>;
  schedule_at: string | null;
  duration_days: number;
  max_impressions_per_user: number;
  delay_between_impressions_hours: number;
  content_blocks: ContentBlock[];
  ab_enabled: boolean;
  ab_ratio: number;
  variant_b_content_blocks: ContentBlock[] | null;
  variant_b_target_persona: Record<string, any> | null;
  variant_b_duration_days: number | null;
  target_user_count: number | null;
  created_at: string;
  created_by: string;
}

interface SurveyStats {
  survey_id: string;
  impressions: number;
  responses: number;
  dismissals: number;
  impressions_a: number;
  impressions_b: number;
  responses_a: number;
  responses_b: number;
}

const BLOCK_TYPES = [
  { value: 'poll', label: 'Sondage' },
  { value: 'rating', label: 'Note /5' },
  { value: 'text_feedback', label: 'Retour texte' },
  { value: 'screenshot', label: 'Capture d\'écran' },
  { value: 'share', label: 'Partage (WhatsApp/SMS)' },
];

const PERSONA_OPTIONS = {
  language: ['fr', 'en', 'es'],
  client_type: ['entrepreneur', 'agence', 'freelance', 'boutique'],
  account_age: ['< 7 jours', '7-30 jours', '1-3 mois', '3-6 mois', '> 6 mois'],
};

const defaultSurvey: Omit<Survey, 'id' | 'created_at' | 'created_by'> = {
  title: '',
  description: null,
  status: 'draft',
  target_pages: ['/console'],
  target_persona: {},
  schedule_at: null,
  duration_days: 7,
  max_impressions_per_user: 1,
  delay_between_impressions_hours: 24,
  content_blocks: [],
  ab_enabled: false,
  ab_ratio: 50,
  variant_b_content_blocks: null,
  variant_b_target_persona: null,
  variant_b_duration_days: null,
  target_user_count: null,
};

function generateBlockId() {
  return Math.random().toString(36).substring(2, 9);
}

function ContentBlockEditor({ block, onChange, onRemove }: { block: ContentBlock; onChange: (b: ContentBlock) => void; onRemove: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline">{BLOCK_TYPES.find(t => t.value === block.type)?.label}</Badge>
          <Button variant="ghost" size="icon" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>

        {(block.type === 'poll' || block.type === 'rating' || block.type === 'text_feedback') && (
          <div>
            <Label className="text-xs flex items-center gap-1"><Eye className="h-3 w-3 text-emerald-500" /> Question</Label>
            <Input value={block.question || ''} onChange={e => onChange({ ...block, question: e.target.value })} placeholder="Votre question..." />
          </div>
        )}

        {block.type === 'poll' && (
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Eye className="h-3 w-3 text-muted-foreground" /> Options (une par ligne)</Label>
            <Textarea
              value={(block.options || []).join('\n')}
              onChange={e => onChange({ ...block, options: e.target.value.split('\n').filter(Boolean) })}
              placeholder="Option A&#10;Option B&#10;Option C"
              rows={3}
            />
          </div>
        )}

        {block.type === 'rating' && (
          <div>
            <Label className="text-xs">Note max</Label>
            <Input type="number" min={3} max={10} value={block.max_rating || 5} onChange={e => onChange({ ...block, max_rating: parseInt(e.target.value) })} />
          </div>
        )}

        {block.type === 'screenshot' && (
          <div>
            <Label className="text-xs flex items-center gap-1"><Eye className="h-3 w-3 text-muted-foreground" /> Label du bouton</Label>
            <Input value={block.label || ''} onChange={e => onChange({ ...block, label: e.target.value })} placeholder="Envoyer une capture d'écran" />
          </div>
        )}

        {block.type === 'share' && (
          <>
            <div>
              <Label className="text-xs">Canal</Label>
              <Select value={block.share_channel || 'whatsapp'} onValueChange={v => onChange({ ...block, share_channel: v as 'whatsapp' | 'sms' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Eye className="h-3 w-3 text-muted-foreground" /> Message pré-rempli</Label>
              <Textarea value={block.share_message || ''} onChange={e => onChange({ ...block, share_message: e.target.value })} placeholder="Découvrez ikTracker..." rows={2} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BlocksEditor({ blocks, onChange }: { blocks: ContentBlock[]; onChange: (b: ContentBlock[]) => void }) {
  const addBlock = (type: string) => {
    const newBlock: ContentBlock = { id: generateBlockId(), type: type as ContentBlock['type'] };
    if (type === 'rating') newBlock.max_rating = 5;
    if (type === 'share') { newBlock.share_channel = 'whatsapp'; newBlock.share_message = ''; }
    onChange([...blocks, newBlock]);
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const arr = [...blocks];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    onChange(arr);
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blocs de contenu</Label>
      {blocks.map((block, i) => (
        <div key={block.id} className="flex gap-2">
          <div className="flex flex-col gap-0.5 pt-4">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(i, -1)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1}><ArrowDown className="h-3 w-3" /></Button>
          </div>
          <div className="flex-1">
            <ContentBlockEditor
              block={block}
              onChange={b => { const arr = [...blocks]; arr[i] = b; onChange(arr); }}
              onRemove={() => onChange(blocks.filter((_, j) => j !== i))}
            />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map(t => (
          <Button key={t.value} variant="outline" size="sm" onClick={() => addBlock(t.value)}>
            <Plus className="h-3 w-3 mr-1" />{t.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function PersonaEditor({ persona, onChange }: { persona: Record<string, any>; onChange: (p: Record<string, any>) => void }) {
  const allSelected = Object.keys(PERSONA_OPTIONS).every(key => {
    const selected = (persona[key] || []) as string[];
    return selected.length === 0 || selected.length === PERSONA_OPTIONS[key as keyof typeof PERSONA_OPTIONS].length;
  }) && Object.keys(persona).filter(k => (persona[k] as string[])?.length > 0).length === 0;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Clear all filters = target everyone
      onChange({});
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ciblage persona</Label>
      <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium">
        <Checkbox
          checked={allSelected}
          onCheckedChange={handleSelectAll}
        />
        Toutes
      </label>
      {Object.entries(PERSONA_OPTIONS).map(([key, values]) => (
        <div key={key}>
          <Label className="text-xs capitalize">{key === 'client_type' ? 'Type de client' : key === 'account_age' ? 'Ancienneté' : 'Langue'}</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {values.map(v => {
              const selected = (persona[key] || []) as string[];
              const isChecked = selected.includes(v);
              return (
                <label key={v} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const newSelected = checked ? [...selected, v] : selected.filter(s => s !== v);
                      onChange({ ...persona, [key]: newSelected.length > 0 ? newSelected : undefined });
                    }}
                  />
                  {v}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SurveyEditor({ survey, onSave, onCancel }: { survey: Partial<Survey>; onSave: (s: Partial<Survey>) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Partial<Survey>>({ ...defaultSurvey, ...survey });
  const [activeVariant, setActiveVariant] = useState<'A' | 'B'>('A');

  const updateField = <K extends keyof Survey>(key: K, value: Survey[K]) => setForm(f => ({ ...f, [key]: value }));

  const handlePublish = () => {
    if (!form.title?.trim()) { toast.error('Titre requis'); return; }
    if (!form.content_blocks?.length) { toast.error('Ajoutez au moins un bloc de contenu'); return; }
    onSave({ ...form, status: 'active' });
  };

  const handleSaveDraft = () => {
    if (!form.title?.trim()) { toast.error('Titre requis'); return; }
    onSave({ ...form, status: 'draft' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{survey?.id ? 'Modifier la survey' : 'Nouvelle survey'}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Annuler</Button>
          <Button variant="outline" size="sm" onClick={handleSaveDraft}>Brouillon</Button>
          <Button size="sm" onClick={handlePublish}>Publier</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left column - Settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Paramètres</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Eye className="h-3 w-3 text-emerald-500" />
                  Titre
                </Label>
                <Input value={form.title || ''} onChange={e => updateField('title', e.target.value)} placeholder="Titre de la survey" />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <Eye className="h-3 w-3 text-destructive" />
                  Description
                </Label>
                <Textarea value={form.description || ''} onChange={e => updateField('description', e.target.value)} placeholder="Description interne (admin only)" rows={2} />
              </div>
              <div>
                <Label className="text-xs">Date d'envoi</Label>
                <Input type="datetime-local" value={form.schedule_at ? new Date(form.schedule_at).toISOString().slice(0, 16) : ''} onChange={e => updateField('schedule_at', e.target.value ? new Date(e.target.value).toISOString() : null)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Durée (jours)</Label>
                  <Input type="number" min={1} value={form.duration_days || 7} onChange={e => updateField('duration_days', parseInt(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Nb users ciblés</Label>
                  <Input type="number" min={1} value={form.target_user_count || ''} onChange={e => updateField('target_user_count', e.target.value ? parseInt(e.target.value) : null)} placeholder="Tous" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Affichages / user</Label>
                  <Input type="number" min={1} value={form.max_impressions_per_user || 1} onChange={e => updateField('max_impressions_per_user', parseInt(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Délai entre 2 (h)</Label>
                  <Input type="number" min={1} value={form.delay_between_impressions_hours || 24} onChange={e => updateField('delay_between_impressions_hours', parseInt(e.target.value))} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Pages cibles (une par ligne)</Label>
                <Textarea
                  value={(form.target_pages || []).join('\n')}
                  onChange={e => updateField('target_pages', e.target.value.split('\n').filter(Boolean) as any)}
                  placeholder="/console&#10;/&#10;/tarifs"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <PersonaEditor persona={form.target_persona || {}} onChange={p => updateField('target_persona', p)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">A/B Testing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.ab_enabled || false} onCheckedChange={v => updateField('ab_enabled', v)} />
                <Label className="text-xs">Activer l'A/B testing</Label>
              </div>
              {form.ab_enabled && (
                <div>
                  <Label className="text-xs">Ratio variante A (%)</Label>
                  <Input type="number" min={10} max={90} value={form.ab_ratio || 50} onChange={e => updateField('ab_ratio', parseInt(e.target.value))} />
                  <p className="text-[10px] text-muted-foreground mt-1">Variante B : {100 - (form.ab_ratio || 50)}%</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column - Content */}
        <div className="space-y-4">
          {form.ab_enabled && (
            <div className="flex gap-2">
              <Button variant={activeVariant === 'A' ? 'default' : 'outline'} size="sm" onClick={() => setActiveVariant('A')}>Variante A</Button>
              <Button variant={activeVariant === 'B' ? 'default' : 'outline'} size="sm" onClick={() => setActiveVariant('B')}>Variante B</Button>
            </div>
          )}

          {activeVariant === 'A' || !form.ab_enabled ? (
            <BlocksEditor
              blocks={(form.content_blocks || []) as ContentBlock[]}
              onChange={b => updateField('content_blocks', b as any)}
            />
          ) : (
            <div className="space-y-4">
              <BlocksEditor
                blocks={(form.variant_b_content_blocks || form.content_blocks || []) as ContentBlock[]}
                onChange={b => updateField('variant_b_content_blocks', b as any)}
              />
              <Card>
                <CardContent className="pt-4">
                  <PersonaEditor
                    persona={form.variant_b_target_persona || form.target_persona || {}}
                    onChange={p => updateField('variant_b_target_persona', p)}
                  />
                </CardContent>
              </Card>
              <div>
                <Label className="text-xs">Durée variante B (jours)</Label>
                <Input type="number" min={1} value={form.variant_b_duration_days || form.duration_days || 7} onChange={e => updateField('variant_b_duration_days', parseInt(e.target.value))} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SurveyManagement() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<Record<string, SurveyStats>>({});
  const [editing, setEditing] = useState<Partial<Survey> | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSurveys = async () => {
    setLoading(true);
    const { data } = await supabase.from('surveys').select('*').order('created_at', { ascending: false });
    if (data) {
      setSurveys(data.map(d => ({
        ...d,
        target_pages: (d.target_pages || []) as string[],
        target_persona: (d.target_persona || {}) as Record<string, any>,
        content_blocks: (d.content_blocks || []) as unknown as ContentBlock[],
        variant_b_content_blocks: d.variant_b_content_blocks as unknown as ContentBlock[] | null,
        variant_b_target_persona: d.variant_b_target_persona as Record<string, any> | null,
      })));

      // Load stats for each survey
      const statsMap: Record<string, SurveyStats> = {};
      for (const survey of data) {
        const { data: events } = await supabase
          .from('survey_events')
          .select('event_type, variant')
          .eq('survey_id', survey.id);
        if (events) {
          statsMap[survey.id] = {
            survey_id: survey.id,
            impressions: events.filter(e => e.event_type === 'impression').length,
            responses: events.filter(e => e.event_type === 'response').length,
            dismissals: events.filter(e => e.event_type === 'dismiss').length,
            impressions_a: events.filter(e => e.event_type === 'impression' && e.variant === 'A').length,
            impressions_b: events.filter(e => e.event_type === 'impression' && e.variant === 'B').length,
            responses_a: events.filter(e => e.event_type === 'response' && e.variant === 'A').length,
            responses_b: events.filter(e => e.event_type === 'response' && e.variant === 'B').length,
          };
        }
      }
      setStats(statsMap);
    }
    setLoading(false);
  };

  useEffect(() => { loadSurveys(); }, []);

  const handleSave = async (formData: Partial<Survey>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload: Record<string, any> = {
      title: formData.title,
      description: formData.description,
      status: formData.status,
      target_pages: formData.target_pages,
      target_persona: formData.target_persona,
      schedule_at: formData.schedule_at,
      duration_days: formData.duration_days,
      max_impressions_per_user: formData.max_impressions_per_user,
      delay_between_impressions_hours: formData.delay_between_impressions_hours,
      content_blocks: formData.content_blocks as any,
      ab_enabled: formData.ab_enabled,
      ab_ratio: formData.ab_ratio,
      variant_b_content_blocks: formData.variant_b_content_blocks as any,
      variant_b_target_persona: formData.variant_b_target_persona,
      variant_b_duration_days: formData.variant_b_duration_days,
      target_user_count: formData.target_user_count,
    };

    if (formData.id) {
      const { error } = await supabase.from('surveys').update(payload as any).eq('id', formData.id);
      if (error) { toast.error('Erreur: ' + error.message); return; }
    } else {
      const { error } = await supabase.from('surveys').insert({ ...payload, created_by: user.id } as any);
      if (error) { toast.error('Erreur: ' + error.message); return; }
    }

    toast.success(formData.status === 'active' ? 'Survey publiée !' : 'Brouillon enregistré');
    setEditing(null);
    loadSurveys();
  };

  const toggleStatus = async (survey: Survey) => {
    const newStatus = survey.status === 'active' ? 'paused' : 'active';
    await supabase.from('surveys').update({ status: newStatus }).eq('id', survey.id);
    loadSurveys();
  };

  if (editing) {
    return <SurveyEditor survey={editing} onSave={handleSave} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Surveys</h3>
        <Button size="sm" onClick={() => setEditing({})}>
          <Plus className="h-3.5 w-3.5 mr-1" />Nouvelle survey
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : surveys.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Aucune survey créée</CardContent></Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Impressions</TableHead>
              <TableHead>Réponses</TableHead>
              <TableHead>Taux rép.</TableHead>
              <TableHead>Fermetures</TableHead>
              <TableHead>A/B</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surveys.map(s => {
              const st = stats[s.id];
              const responseRate = st && st.impressions > 0 ? ((st.responses / st.impressions) * 100).toFixed(1) : '—';
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.title}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'active' ? 'default' : s.status === 'paused' ? 'secondary' : 'outline'} className="text-[10px]">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{st?.impressions || 0}</TableCell>
                  <TableCell>{st?.responses || 0}</TableCell>
                  <TableCell>{responseRate}%</TableCell>
                  <TableCell>{st?.dismissals || 0}</TableCell>
                  <TableCell>
                    {s.ab_enabled ? (
                      <div className="text-[10px]">
                        <div>A: {st?.responses_a || 0}/{st?.impressions_a || 0}</div>
                        <div>B: {st?.responses_b || 0}/{st?.impressions_b || 0}</div>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(s)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(s)}>
                        {s.status === 'active' ? <Eye className="h-3 w-3" /> : <Eye className="h-3 w-3 opacity-40" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
