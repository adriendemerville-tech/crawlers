import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SiteIdentityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Record<string, any>;
  onUpdate?: () => void;
}

// All taxonomy fields from tracked_sites + 4 new ones
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
  // 4 new fields not yet detected
  { key: 'short_term_goal', label: 'Objectif court terme' },
  { key: 'mid_term_goal', label: 'Objectif moyen terme' },
  { key: 'main_serp_competitor', label: 'Concurrent SERP principal' },
  { key: 'confusion_risk', label: 'Risque de confusion' },
];

const MARKET_LABELS: Record<string, string> = {
  B2B: 'B2B',
  B2C: 'B2C',
  B2B2C: 'B2B2C',
};

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

export function SiteIdentityModal({ open, onOpenChange, site, onUpdate }: SiteIdentityModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize dynamic fields from site data
  useEffect(() => {
    if (open) {
      const fields: Record<string, string> = {};
      for (const f of TAXONOMY_FIELDS) {
        const val = site[f.key];
        if (val !== null && val !== undefined) {
          if (Array.isArray(val)) {
            fields[f.key] = val.join(', ');
          } else if (typeof val === 'object') {
            fields[f.key] = JSON.stringify(val);
          } else {
            fields[f.key] = String(val);
          }
        }
      }
      setDynamicFields(fields);
    }
  }, [open, site]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access error:', err);
      toast.error('Impossible d\'accéder au microphone. Vérifiez les permissions du navigateur.');
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
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(blob);
      const audioBase64 = await base64Promise;

      // Send to edge function for transcription + taxonomy extraction
      const { data, error } = await supabase.functions.invoke('voice-identity-enrichment', {
        body: {
          audio_base64: audioBase64,
          site_id: site.id,
          domain: site.domain,
          current_fields: dynamicFields,
        },
      });

      if (error) throw error;

      if (data?.enriched_fields) {
        const newFields = { ...dynamicFields, ...data.enriched_fields };
        setDynamicFields(newFields);
        toast.success('Carte d\'identité enrichie avec succès');
        onUpdate?.();
      }
    } catch (err) {
      console.error('Voice processing error:', err);
      toast.error('Erreur lors du traitement vocal');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatValue = (key: string, value: string | undefined) => {
    if (!value || value === 'null' || value === 'undefined') {
      return <span className="text-muted-foreground/50 italic text-xs">Non renseigné</span>;
    }
    return <span className="text-sm text-foreground">{value}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Carte d'identité
            <Badge variant="outline" className="text-[10px]">{site.domain}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Taxonomy grid */}
        <div className="space-y-1.5 mt-2">
          {TAXONOMY_FIELDS.map((field) => (
            <div key={field.key} className="flex items-start gap-3 py-1.5 border-b border-border/30 last:border-0">
              <span className="text-xs font-medium text-muted-foreground w-36 shrink-0 pt-0.5">
                {field.label}
              </span>
              <div className="flex-1 min-w-0">
                {formatValue(field.key, dynamicFields[field.key])}
              </div>
            </div>
          ))}
        </div>

        {/* Confidence badge */}
        {site.identity_confidence != null && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground">Confiance :</span>
            <Badge variant={site.identity_confidence >= 70 ? 'default' : 'secondary'} className="text-[10px]">
              {site.identity_confidence}%
            </Badge>
            {site.identity_source && (
              <Badge variant="outline" className="text-[10px]">{site.identity_source}</Badge>
            )}
          </div>
        )}

        {/* Microphone button */}
        <div className="flex flex-col items-center gap-3 mt-4">
          <Button
            variant={isRecording ? 'destructive' : 'outline'}
            size="lg"
            className={`rounded-full w-14 h-14 p-0 transition-all ${
              isRecording ? 'animate-pulse shadow-lg shadow-destructive/30' : ''
            }`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            {isProcessing
              ? 'Analyse en cours…'
              : isRecording
                ? 'Parlez maintenant — cliquez pour arrêter'
                : 'Enrichissez la carte vocalement'}
          </p>
        </div>

        {/* Instructions dropdown */}
        <Collapsible open={showInstructions} onOpenChange={setShowInstructions} className="mt-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full gap-2 text-xs text-muted-foreground justify-center">
              Mode d'emploi
              {showInstructions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 p-4 rounded-lg bg-muted/30 border space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground text-xs uppercase tracking-wide">Conseils</p>
            <p>• Soyez bref, faites des phrases courtes</p>
            <p>• Soyez précis, utilisez des mots clés, des chiffres</p>
            <div className="border-t border-border/40 pt-3 mt-3 space-y-2">
              <p className="font-medium text-foreground text-xs">Répondez à ces questions :</p>
              <p>❶ Quel est votre objectif business à court terme ? À moyen terme ?</p>
              <p>❷ Qui est votre principal concurrent dans la SERP ? Quel est votre principal concurrent en général ?</p>
              <p>❸ Avec qui Crawlers ne doit pas confondre votre entreprise ? Avec quelle activité ne doit-on pas confondre votre entreprise ?</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </DialogContent>
    </Dialog>
  );
}
