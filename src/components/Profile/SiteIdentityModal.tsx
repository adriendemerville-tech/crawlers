import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, ChevronDown, ChevronUp, Loader2, Pencil, Check, X, Search, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SiteIdentityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Record<string, any>;
  onUpdate?: () => void;
}

const TAXONOMY_FIELDS = [
  { key: 'site_name', label: 'Nom du site' },
  { key: 'brand_name', label: 'Nom de marque' },
  { key: 'entity_type', label: "Type d'entité" },
  { key: 'market_sector', label: "Secteur d'activité" },
  { key: 'products_services', label: 'Produits / Services' },
  { key: 'target_audience', label: 'Audience cible' },
  { key: 'commercial_area', label: 'Zone commerciale' },
  { key: 'company_size', label: "Taille de l'entreprise" },
  { key: 'business_type', label: "Type de business" },
  { key: 'primary_language', label: 'Langue principale' },
  { key: 'founding_year', label: 'Année de fondation' },
  { key: 'legal_structure', label: 'Structure juridique' },
  { key: 'siren_siret', label: 'SIREN / SIRET' },
  { key: 'address', label: 'Adresse' },
  { key: 'gmb_city', label: 'Ville GMB' },
  { key: 'cms_platform', label: 'Plateforme CMS' },
  { key: 'media_specialties', label: 'Spécialités média' },
  { key: 'competitors', label: 'Concurrents' },
  { key: 'social_profiles', label: 'Profils sociaux' },
  { key: 'short_term_goal', label: 'Objectif court terme' },
  { key: 'mid_term_goal', label: 'Objectif moyen terme' },
  { key: 'main_serp_competitor', label: 'Concurrent SERP principal' },
  { key: 'confusion_risk', label: 'Risque de confusion' },
];

const MAX_EMPTY_SHOWN = 3;

function formatTargetSummary(target: any): string {
  const parts: string[] = [];
  if (target.market) parts.push(target.market);
  if (target.b2b) {
    if (target.b2b.segment) parts.push(target.b2b.segment);
    if (target.b2b.sector) parts.push(target.b2b.sector);
    if (target.b2b.job_segment) parts.push(target.b2b.job_segment);
  }
  if (target.b2c) {
    if (target.b2c.gender && target.b2c.gender !== 'Tous') parts.push(target.b2c.gender);
    if (target.b2c.age_range) parts.push(target.b2c.age_range);
    if (target.b2c.csp) parts.push(target.b2c.csp);
    if (target.b2c.purchasing_power) parts.push(target.b2c.purchasing_power);
  }
  if (target.geo_scope) parts.push(target.geo_scope);
  return parts.join(' · ') || 'Non défini';
}

function EditableField({ label, value, onSave }: { label: string; value: string | undefined; onSave: (v: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isHovered, setIsHovered] = useState(false);

  const handleSave = () => { onSave(editValue); setIsEditing(false); };
  const handleCancel = () => { setEditValue(value || ''); setIsEditing(false); };
  const isEmpty = !value || value === 'null' || value === 'undefined';

  return (
    <div
      className="flex items-center gap-3 py-2 border-b border-border/15 last:border-0 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-xs font-medium text-muted-foreground w-[140px] shrink-0">{label}</span>
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        {isEditing ? (
          <div className="flex items-center gap-1.5 w-full">
            <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-7 text-sm py-0 px-2" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }} />
            <button onClick={handleSave} className="text-emerald-500 hover:text-emerald-400 shrink-0"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <>
            {isEmpty ? (
              <span className="text-muted-foreground/40 italic text-xs">Non renseigné</span>
            ) : (
              <span className="text-sm text-foreground">{value}</span>
            )}
            {isHovered && (
              <button onClick={() => { setEditValue(value || ''); setIsEditing(true); }}
                className="text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 ml-auto">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type ModalView = 'attributes' | 'instructions';

export function SiteIdentityModal({ open, onOpenChange, site, onUpdate }: SiteIdentityModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [activeView, setActiveView] = useState<ModalView>('attributes');
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (open) {
      setActiveView('attributes');
      const fields: Record<string, string> = {};
      for (const f of TAXONOMY_FIELDS) {
        const val = site[f.key];
        if (val !== null && val !== undefined) {
          if (Array.isArray(val)) fields[f.key] = val.join(', ');
          else if (typeof val === 'object') fields[f.key] = JSON.stringify(val);
          else fields[f.key] = String(val);
        }
      }
      setDynamicFields(fields);
    }
  }, [open, site]);

  const { leftFields, rightFields, hasHiddenEmpty } = useMemo(() => {
    const filled: typeof TAXONOMY_FIELDS = [];
    const empty: typeof TAXONOMY_FIELDS = [];
    for (const f of TAXONOMY_FIELDS) {
      const val = dynamicFields[f.key];
      if (val && val !== 'null' && val !== 'undefined') filled.push(f);
      else empty.push(f);
    }
    const shownEmpty = empty.slice(0, MAX_EMPTY_SHOWN);
    const allShown = [...filled, ...shownEmpty];
    const mid = Math.ceil(allShown.length / 2);
    return { leftFields: allShown.slice(0, mid), rightFields: allShown.slice(mid), hasHiddenEmpty: empty.length > MAX_EMPTY_SHOWN };
  }, [dynamicFields]);

  const handleFieldSave = async (key: string, value: string) => {
    setDynamicFields(prev => ({ ...prev, [key]: value }));
    try {
      await supabase.from('tracked_sites').update({ [key]: value } as any).eq('id', site.id);
      onUpdate?.();
    } catch (e) { console.warn('Failed to save field:', e); }
  };

  const scrapeSociete = async () => {
    if (!site.brand_name && !site.site_name && !site.domain) return;
    setIsScraping(true);
    try {
      const searchTerm = site.brand_name || site.site_name || site.domain;
      const { data, error } = await supabase.functions.invoke('fetch-external-site', {
        body: { url: `https://www.societe.com/cgi-bin/search?champs=${encodeURIComponent(searchTerm)}`, extract_fields: ['founding_year', 'legal_structure', 'siren_siret'] },
      });
      if (error) throw error;
      if (data?.extracted) {
        const updates: Record<string, string> = {};
        if (data.extracted.founding_year && !dynamicFields.founding_year) updates.founding_year = data.extracted.founding_year;
        if (data.extracted.legal_structure && !dynamicFields.legal_structure) updates.legal_structure = data.extracted.legal_structure;
        if (data.extracted.siren_siret && !dynamicFields.siren_siret) updates.siren_siret = data.extracted.siren_siret;
        if (Object.keys(updates).length > 0) {
          setDynamicFields(prev => ({ ...prev, ...updates }));
          await supabase.from('tracked_sites').update(updates as any).eq('id', site.id);
          toast.success(`${Object.keys(updates).length} champ(s) enrichi(s)`);
          onUpdate?.();
        } else { toast.info('Aucune nouvelle donnée trouvée'); }
      }
    } catch (err) { console.warn('Societe.com scraping error:', err); toast.error('Impossible de récupérer les données'); }
    finally { setIsScraping(false); }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => { stream.getTracks().forEach(t => t.stop()); await processAudio(new Blob(chunksRef.current, { type: 'audio/webm' })); };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { console.error('Microphone access error:', err); toast.error("Impossible d'accéder au microphone."); }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); }
  }, [isRecording]);

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => { reader.onloadend = () => resolve((reader.result as string).split(',')[1]); });
      reader.readAsDataURL(blob);
      const audioBase64 = await base64Promise;
      const { data, error } = await supabase.functions.invoke('voice-identity-enrichment', {
        body: { audio_base64: audioBase64, site_id: site.id, domain: site.domain, current_fields: dynamicFields },
      });
      if (error) throw error;
      if (data?.enriched_fields) { setDynamicFields(prev => ({ ...prev, ...data.enriched_fields })); toast.success("Carte d'identité enrichie avec succès"); onUpdate?.(); }
    } catch (err) { console.error('Voice processing error:', err); toast.error('Erreur lors du traitement vocal'); }
    finally { setIsProcessing(false); }
  };

  const hasTargets = site.client_targets && (site.client_targets.primary?.length > 0 || site.client_targets.secondary?.length > 0 || site.client_targets.untapped?.length > 0);
  const filledCount = Object.values(dynamicFields).filter(v => v && v !== 'null' && v !== 'undefined').length;

  const toggleView = () => setActiveView(prev => prev === 'attributes' ? 'instructions' : 'attributes');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Carte d'identité
            <Badge variant="outline" className="text-[10px]">{site.domain}</Badge>
            <span className="text-xs text-muted-foreground ml-auto tabular-nums">{filledCount}/{TAXONOMY_FIELDS.length}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Voice enrichment hero — always visible */}
        <div className={`relative rounded-xl p-4 border-2 transition-all duration-300 ${
          isRecording
            ? 'border-destructive bg-destructive/5 shadow-lg shadow-destructive/10'
            : 'border-[hsl(var(--brand-violet))]/40 bg-gradient-to-r from-[hsl(var(--brand-violet))]/[0.06] to-destructive/[0.04] hover:border-[hsl(var(--brand-violet))]/60'
        }`}>
          <div className="flex items-center gap-4">
            <Button
              variant={isRecording ? 'destructive' : 'default'}
              size="icon"
              className={`rounded-full w-12 h-12 shrink-0 transition-all ${
                isRecording
                  ? 'animate-pulse shadow-lg shadow-destructive/40'
                  : 'bg-[hsl(var(--brand-violet))] hover:bg-[hsl(var(--brand-violet))]/90 shadow-md shadow-[hsl(var(--brand-violet))]/20'
              }`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[hsl(var(--brand-violet))]" />
                {isProcessing ? 'Analyse en cours…' : isRecording ? 'Parlez maintenant — cliquez pour arrêter' : 'Enrichir vocalement'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Décrivez votre activité, vos objectifs et vos concurrents en quelques phrases
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs text-muted-foreground shrink-0"
              onClick={toggleView}
            >
              {activeView === 'attributes' ? 'Aide' : 'Attributs'}
              {activeView === 'attributes' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Content area — exclusive: either attributes OR instructions */}
        <div className="relative min-h-[280px]">
          {/* ATTRIBUTES VIEW */}
          <div
            className={`transition-all duration-300 ease-out ${
              activeView === 'attributes'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-3 pointer-events-none absolute inset-0'
            }`}
          >
            {/* Two-column taxonomy grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
              <div>
                {leftFields.map((field) => (
                  <EditableField key={field.key} label={field.label} value={dynamicFields[field.key]} onSave={(v) => handleFieldSave(field.key, v)} />
                ))}
              </div>
              <div>
                {rightFields.map((field) => (
                  <EditableField key={field.key} label={field.label} value={dynamicFields[field.key]} onSave={(v) => handleFieldSave(field.key, v)} />
                ))}
              </div>
            </div>

            {hasHiddenEmpty && (
              <p className="text-center text-muted-foreground/50 text-sm tracking-widest select-none mt-1">…</p>
            )}

            {/* Enrichir button */}
            <div className="flex justify-end mt-3">
              <Button variant="outline" size="sm" onClick={scrapeSociete} disabled={isScraping} className="text-xs gap-1.5">
                {isScraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                Enrichir
              </Button>
            </div>

            {/* Client Targets */}
            {hasTargets && (
              <div className="pt-3 mt-2 border-t border-border/30 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cibles Clients</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {site.client_targets.primary?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-emerald-500 font-medium">Principales</p>
                      {site.client_targets.primary.map((t: any, i: number) => (
                        <p key={`p-${i}`} className="text-xs text-foreground pl-2 border-l-2 border-emerald-500/30">{formatTargetSummary(t)}</p>
                      ))}
                    </div>
                  )}
                  {site.client_targets.secondary?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-amber-500 font-medium">Secondaires</p>
                      {site.client_targets.secondary.map((t: any, i: number) => (
                        <p key={`s-${i}`} className="text-xs text-foreground pl-2 border-l-2 border-amber-500/30">{formatTargetSummary(t)}</p>
                      ))}
                    </div>
                  )}
                  {site.client_targets.untapped?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-violet-500 font-medium">Potentielles</p>
                      {site.client_targets.untapped.map((t: any, i: number) => (
                        <p key={`u-${i}`} className="text-xs text-foreground/70 italic pl-2 border-l-2 border-violet-500/30">{formatTargetSummary(t)}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* INSTRUCTIONS VIEW */}
          <div
            className={`transition-all duration-300 ease-out ${
              activeView === 'instructions'
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-3 pointer-events-none absolute inset-0'
            }`}
          >
            <div className="p-5 rounded-xl bg-muted/30 border border-border/30 space-y-4">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Mode d'emploi — enrichissement vocal</p>

              <div className="space-y-2.5 text-sm text-muted-foreground">
                <p>• Soyez bref, faites des phrases courtes et directes</p>
                <p>• Utilisez des mots-clés, des chiffres, des noms propres</p>
                <p>• Parlez de votre activité comme vous l'expliqueriez à un partenaire</p>
              </div>

              <div className="border-t border-border/40 pt-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">Répondez à ces 3 questions :</p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border border-border/20">
                    <span className="text-base font-bold text-[hsl(var(--brand-violet))]">❶</span>
                    <p className="text-sm text-foreground">Quel est votre objectif business à <strong>court terme</strong> ? À <strong>moyen terme</strong> ?</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border border-border/20">
                    <span className="text-base font-bold text-[hsl(var(--brand-violet))]">❷</span>
                    <p className="text-sm text-foreground">Qui est votre <strong>principal concurrent</strong> dans la SERP ? Et de manière générale ?</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border border-border/20">
                    <span className="text-base font-bold text-destructive">❸</span>
                    <p className="text-sm text-foreground">Avec quelle entreprise Crawlers ne doit <strong>pas vous confondre</strong> ?</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}