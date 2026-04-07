import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, RefreshCw, AlertTriangle, CheckCircle, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceDNA {
  dominant_register: string;
  dominant_posture: string;
  dominant_addressing: string;
  sentence_style: string;
  lexical_density: string;
  emotional_tone: string;
  consistency_score: number;
  inconsistencies: { url: string; field: string; expected: string; found: string }[];
  sample_excerpts: string[];
  tone_overrides: Record<string, any>;
  forbidden_words?: string[];
  mandatory_words?: string[];
  last_analyzed_at: string;
}

interface VoiceDNAEditorProps {
  trackedSiteId: string;
  domain: string;
}

const REGISTER_OPTIONS = ['formel', 'informel', 'mixte'];
const POSTURE_OPTIONS = ['pedagogique', 'commercial', 'expert', 'pair', 'autoritaire', 'narratif'];
const ADDRESSING_OPTIONS = ['tutoiement', 'vouvoiement', 'impersonnel', 'mixte'];
const SENTENCE_OPTIONS = ['courtes', 'longues', 'mixtes'];
const LEXICAL_OPTIONS = ['simple', 'technique', 'jargon', 'mixte'];
const EMOTION_OPTIONS = ['neutre', 'enthousiaste', 'urgent', 'rassurant', 'provocateur'];

export function VoiceDNAEditor({ trackedSiteId, domain }: VoiceDNAEditorProps) {
  const [voiceDna, setVoiceDna] = useState<VoiceDNA | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [forbiddenWords, setForbiddenWords] = useState('');
  const [mandatoryWords, setMandatoryWords] = useState('');

  useEffect(() => {
    loadVoiceDNA();
  }, [trackedSiteId]);

  async function loadVoiceDNA() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('tracked_sites')
        .select('voice_dna')
        .eq('id', trackedSiteId)
        .single();
      
      const dna = data?.voice_dna as unknown as VoiceDNA | null;
      setVoiceDna(dna);
      setForbiddenWords((dna?.forbidden_words || []).join(', '));
      setMandatoryWords((dna?.mandatory_words || []).join(', '));
    } catch (e) {
      console.error('Failed to load Voice DNA:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-voice-tone', {
        body: { mode: 'consolidate', tracked_site_id: trackedSiteId, domain },
      });
      if (error) throw error;
      if (data?.voice_dna) {
        setVoiceDna(data.voice_dna);
        setForbiddenWords((data.voice_dna.forbidden_words || []).join(', '));
        setMandatoryWords((data.voice_dna.mandatory_words || []).join(', '));
        toast.success('Voice DNA consolidé à partir des crawls existants');
      } else {
        toast.info('Aucune donnée tonale disponible. Lancez d\'abord un crawl.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'analyse');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!voiceDna) return;
    setSaving(true);
    try {
      const updated = {
        ...voiceDna,
        forbidden_words: forbiddenWords.split(',').map(w => w.trim()).filter(Boolean),
        mandatory_words: mandatoryWords.split(',').map(w => w.trim()).filter(Boolean),
      };
      
      const { error } = await supabase
        .from('tracked_sites')
        .update({ voice_dna: updated } as any)
        .eq('id', trackedSiteId);
      
      if (error) throw error;
      setVoiceDna(updated);
      toast.success('Voice DNA sauvegardé');
    } catch (e: any) {
      toast.error(e.message || 'Erreur sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof VoiceDNA, value: string) {
    setVoiceDna(prev => prev ? { ...prev, [field]: value } : null);
  }

  const scoreColor = (score: number) =>
    score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-destructive';

  if (loading) {
    return (
      <Card className="border border-border/50">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Chargement du Voice DNA…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            Voice DNA — Identité Éditoriale
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="text-xs gap-1.5"
            >
              {analyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {voiceDna ? 'Ré-analyser' : 'Analyser depuis les crawls'}
            </Button>
            {voiceDna && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs gap-1.5">
                <Save className="w-3 h-3" />
                Sauvegarder
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!voiceDna ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Mic className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Aucun Voice DNA détecté.</p>
            <p className="text-xs mt-1">Lancez un crawl puis cliquez "Analyser" pour extraire le ton éditorial de votre site.</p>
          </div>
        ) : (
          <>
            {/* Consistency Score */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
              <div>
                <div className="text-xs text-muted-foreground">Score de cohérence tonale</div>
                <div className={`text-2xl font-bold ${scoreColor(voiceDna.consistency_score)}`}>
                  {voiceDna.consistency_score}/100
                </div>
              </div>
              {voiceDna.consistency_score >= 75 ? (
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              )}
            </div>

            {/* Editable Fields Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-medium">Registre</label>
                <Select value={voiceDna.dominant_register} onValueChange={v => updateField('dominant_register', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGISTER_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-medium">Posture</label>
                <Select value={voiceDna.dominant_posture} onValueChange={v => updateField('dominant_posture', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POSTURE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-medium">Adresse</label>
                <Select value={voiceDna.dominant_addressing} onValueChange={v => updateField('dominant_addressing', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ADDRESSING_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-medium">Phrases</label>
                <Select value={voiceDna.sentence_style} onValueChange={v => updateField('sentence_style', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SENTENCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-medium">Lexique</label>
                <Select value={voiceDna.lexical_density} onValueChange={v => updateField('lexical_density', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEXICAL_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-medium">Émotion</label>
                <Select value={voiceDna.emotional_tone} onValueChange={v => updateField('emotional_tone', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMOTION_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lexicon control */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-medium">Mots interdits (séparés par virgule)</label>
                <Input
                  value={forbiddenWords}
                  onChange={e => setForbiddenWords(e.target.value)}
                  placeholder="ex: leader, révolutionnaire, synergies"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-medium">Mots obligatoires (séparés par virgule)</label>
                <Input
                  value={mandatoryWords}
                  onChange={e => setMandatoryWords(e.target.value)}
                  placeholder="ex: votre marque, notre solution"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Inconsistencies */}
            {voiceDna.inconsistencies?.length > 0 && (
              <div>
                <div className="text-[10px] uppercase text-muted-foreground font-medium mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Incohérences détectées ({voiceDna.inconsistencies.length})
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {voiceDna.inconsistencies.slice(0, 10).map((inc, i) => (
                    <div key={i} className="text-[11px] p-2 rounded bg-amber-500/5 border border-amber-500/20 flex items-start gap-2">
                      <Badge variant="outline" className="text-[9px] shrink-0">{inc.field}</Badge>
                      <span className="text-muted-foreground truncate">{inc.url}</span>
                      <span className="shrink-0">
                        <span className="text-destructive">{inc.found}</span> → <span className="text-emerald-500">{inc.expected}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tone Overrides per page type */}
            {Object.keys(voiceDna.tone_overrides || {}).length > 0 && (
              <div>
                <div className="text-[10px] uppercase text-muted-foreground font-medium mb-2">
                  Variations tonales par type de page
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(voiceDna.tone_overrides).map(([pageType, override]) => (
                    <Badge key={pageType} variant="secondary" className="text-[10px]">
                      {pageType}: {Object.entries(override as any).map(([k, v]) => `${k}=${v}`).join(', ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {voiceDna.last_analyzed_at && (
              <div className="text-[10px] text-muted-foreground text-right">
                Dernière analyse: {new Date(voiceDna.last_analyzed_at).toLocaleDateString('fr-FR')}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
