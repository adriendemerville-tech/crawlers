import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, ChevronDown, ChevronUp, Loader2, Pencil, Check, X, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  const isEmpty = !value || value === 'null' || value === 'undefined';

  return (
    <div
      className="flex items-start gap-2 py-1.5 border-b border-border/20 last:border-0 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="text-[11px] font-medium text-muted-foreground w-[130px] shrink-0 pt-1 leading-tight">
        {label}
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-1">
        {isEditing ? (
          <div className="flex items-center gap-1 w-full">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-6 text-xs py-0 px-1.5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
            />
            <button onClick={handleSave} className="text-emerald-500 hover:text-emerald-400 shrink-0">
              <Check className="h-3 w-3" />
            </button>
            <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <>
            {isEmpty ? (
              <span className="text-muted-foreground/40 italic text-[11px]">Non renseigné</span>
            ) : (
              <span className="text-xs text-foreground leading-tight">{value}</span>
            )}
            {isHovered && (
              <button
                onClick={() => { setEditValue(value || ''); setIsEditing(true); }}
                className="text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 ml-auto"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function SiteIdentityModal({ open, onOpenChange, site, onUpdate }: SiteIdentityModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (open) {
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

  const handleFieldSave = async (key: string, value: string) => {
    setDynamicFields(prev => ({ ...prev, [key]: value }));
    try {
      await supabase
        .from('tracked_sites')
        .update({ [key]: value } as any)
        .eq('id', site.id);
      onUpdate?.();
    } catch (e) {
      console.warn('Failed to save field:', e);
    }
  };

  const scrapeSociete = async () => {
    if (!site.brand_name && !site.site_name && !site.domain) return;
    setIsScraping(true);
    try {
      const searchTerm = site.brand_name || site.site_name || site.domain;
      const { data, error } = await supabase.functions.invoke('fetch-external-site', {
        body: {
          url: `https://www.societe.com/cgi-bin/search?champs=${encodeURIComponent(searchTerm)}`,
          extract_fields: ['founding_year', 'legal_structure', 'siren_siret'],
        },
      });

      if (error) throw error;

      if (data?.extracted) {
        const updates: Record<string, string> = {};
        if (data.extracted.founding_year && !dynamicFields.founding_year) {
          updates.founding_year = data.extracted.founding_year;
        }
        if (data.extracted.legal_structure && !dynamicFields.legal_structure) {
          updates.legal_structure = data.extracted.legal_structure;
        }
        if (data.extracted.siren_siret && !dynamicFields.siren_siret) {
          updates.siren_siret = data.extracted.siren_siret;
        }

        if (Object.keys(updates).length > 0) {
          setDynamicFields(prev => ({ ...prev, ...updates }));
          await supabase
            .from('tracked_sites')
            .update(updates as any)
            .eq('id', site.id);
          toast.success(`${Object.keys(updates).length} champ(s) enrichi(s) via societe.com`);
          onUpdate?.();
        } else {
          toast.info('Aucune nouvelle donnée trouvée sur societe.com');
        }
      }
    } catch (err) {
      console.warn('Societe.com scraping error:', err);
      toast.error('Impossible de récupérer les données de societe.com');
    } finally {
      setIsScraping(false);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(blob);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access error:', err);
      toast.error("Impossible d'accéder au microphone.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      });
      reader.readAsDataURL(blob);
      const audioBase64 = await base64Promise;
      const { data, error } = await supabase.functions.invoke('voice-identity-enrichment', {
        body: { audio_base64: audioBase64, site_id: site.id, domain: site.domain, current_fields: dynamicFields },
      });
      if (error) throw error;
      if (data?.enriched_fields) {
        setDynamicFields(prev => ({ ...prev, ...data.enriched_fields }));
        toast.success("Carte d'identité enrichie avec succès");
        onUpdate?.();
      }
    } catch (err) {
      console.error('Voice processing error:', err);
      toast.error('Erreur lors du traitement vocal');
    } finally {
      setIsProcessing(false);
    }
  };

  const midpoint = Math.ceil(TAXONOMY_FIELDS.length / 2);
  const leftFields = TAXONOMY_FIELDS.slice(0, midpoint);
  const rightFields = TAXONOMY_FIELDS.slice(midpoint);

  const hasTargets = site.client_targets && (
    site.client_targets.primary?.length > 0 ||
    site.client_targets.secondary?.length > 0 ||
    site.client_targets.untapped?.length > 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Carte d'identité
            <Badge variant="outline" className="text-[10px]">{site.domain}</Badge>
            {site.identity_confidence != null && (
              <Badge variant={site.identity_confidence >= 70 ? 'default' : 'secondary'} className="text-[10px] ml-auto">
                Confiance {site.identity_confidence}%
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Two-column taxonomy grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0 mt-3">
          <div>
            {leftFields.map((field) => (
              <EditableField
                key={field.key}
                label={field.label}
                value={dynamicFields[field.key]}
                onSave={(v) => handleFieldSave(field.key, v)}
              />
            ))}
          </div>
          <div>
            {rightFields.map((field) => (
              <EditableField
                key={field.key}
                label={field.label}
                value={dynamicFields[field.key]}
                onSave={(v) => handleFieldSave(field.key, v)}
              />
            ))}
          </div>
        </div>

        {/* Societe.com scrape button */}
        <div className="flex justify-end mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={scrapeSociete}
            disabled={isScraping}
            className="text-xs gap-1.5"
          >
            {isScraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Enrichir via societe.com
          </Button>
        </div>

        {/* Client Targets */}
        {hasTargets && (
          <div className="pt-3 border-t border-border/30 space-y-2">
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

        {/* Microphone + Instructions */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
          <Button
            variant={isRecording ? 'destructive' : 'outline'}
            size="sm"
            className={`rounded-full w-10 h-10 p-0 shrink-0 transition-all ${isRecording ? 'animate-pulse shadow-lg shadow-destructive/30' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {isProcessing ? 'Analyse en cours…' : isRecording ? 'Parlez maintenant — cliquez pour arrêter' : 'Enrichissez la carte vocalement'}
          </p>
          <div className="ml-auto">
            <Collapsible open={showInstructions} onOpenChange={setShowInstructions}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-[10px] text-muted-foreground">
                  Mode d'emploi {showInstructions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>

        {showInstructions && (
          <div className="p-3 rounded-lg bg-muted/30 border space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground text-[10px] uppercase tracking-wide">Conseils</p>
            <p>• Soyez bref, faites des phrases courtes</p>
            <p>• Soyez précis, utilisez des mots clés, des chiffres</p>
            <div className="border-t border-border/40 pt-2 mt-2 space-y-1.5">
              <p className="font-medium text-foreground text-[10px]">Répondez à ces questions :</p>
              <p>❶ Quel est votre objectif business à court terme ? À moyen terme ?</p>
              <p>❷ Qui est votre principal concurrent dans la SERP ? En général ?</p>
              <p>❸ Avec qui Crawlers ne doit pas confondre votre entreprise ?</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
