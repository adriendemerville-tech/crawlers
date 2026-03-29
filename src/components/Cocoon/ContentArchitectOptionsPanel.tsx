import { Settings, Users, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export type AudienceSegment = 'primary' | 'secondary' | 'untapped' | 'all';

interface ContentArchitectOptionsPanelProps {
  competitorUrl: string;
  setCompetitorUrl: (v: string) => void;
  ctaLink: string;
  setCtaLink: (v: string) => void;
  photoUrl: string;
  setPhotoUrl: (v: string) => void;
  tone: string;
  setTone: (v: string) => void;
  autoFilled: Set<string>;
  audienceSegment: AudienceSegment;
  setAudienceSegment: (v: AudienceSegment) => void;
  audienceDetails?: {
    primary?: string;
    secondary?: string;
    untapped?: string;
  };
}

const AUDIENCE_OPTIONS: { value: AudienceSegment; label: string; description: string }[] = [
  { value: 'primary', label: 'Cible prioritaire', description: 'Audience principale du site' },
  { value: 'secondary', label: 'Cible secondaire', description: 'Audience complémentaire' },
  { value: 'untapped', label: 'Opportunités', description: 'Segments non encore exploités' },
  { value: 'all', label: 'Toutes les cibles', description: 'Contenu multi-audience' },
];

export function ContentArchitectOptionsPanel({
  competitorUrl, setCompetitorUrl, ctaLink, setCtaLink, photoUrl, setPhotoUrl, tone, setTone, autoFilled,
  audienceSegment, setAudienceSegment, audienceDetails,
}: ContentArchitectOptionsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <Settings className="w-3.5 h-3.5 text-white/50 stroke-[1.5]" />
        <h3 className="text-xs font-semibold text-white/70">Options avancées</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Audience Segment Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1">
              <Target className="w-3 h-3 stroke-[1.5]" />
              Cible du contenu
            </label>
            <Select value={audienceSegment} onValueChange={(v) => setAudienceSegment(v as AudienceSegment)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Show audience detail for selected segment */}
            {audienceDetails && audienceSegment !== 'all' && audienceDetails[audienceSegment] && (
              <div className="mt-1 p-2 rounded-md bg-white/5 border border-white/10">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3 h-3 text-emerald-400/70 stroke-[1.5]" />
                  <span className="text-[9px] text-white/50 uppercase tracking-wider">
                    {audienceSegment === 'primary' ? 'Prioritaire' : audienceSegment === 'secondary' ? 'Secondaire' : 'Opportunité'}
                  </span>
                </div>
                <p className="text-[10px] text-white/60 leading-relaxed">{audienceDetails[audienceSegment]}</p>
              </div>
            )}
            {audienceSegment === 'all' && audienceDetails && (
              <div className="mt-1 space-y-1">
                {audienceDetails.primary && (
                  <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400/70 mr-1">
                    P: {audienceDetails.primary.substring(0, 50)}…
                  </Badge>
                )}
                {audienceDetails.secondary && (
                  <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-400/70 mr-1">
                    S: {audienceDetails.secondary.substring(0, 50)}…
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1">
              URL concurrent
              {autoFilled.has('competitorUrl') && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
            </label>
            <Input value={competitorUrl} onChange={e => setCompetitorUrl(e.target.value)} placeholder="https://concurrent.com/page" className="bg-white/5 border-white/10 text-white text-xs h-8" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1">
              Lien CTA cible
              {autoFilled.has('ctaLink') && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
            </label>
            <Input value={ctaLink} onChange={e => setCtaLink(e.target.value)} placeholder="https://..." className="bg-white/5 border-white/10 text-white text-xs h-8" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Photo / média</label>
            <Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="URL image ou description" className="bg-white/5 border-white/10 text-white text-xs h-8" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1">
              Ton souhaité
              {autoFilled.has('tone') && <span className="text-[9px] text-[#fbbf24]/60 normal-case">auto</span>}
            </label>
            <Input value={tone} onChange={e => setTone(e.target.value)} placeholder="Expert, accessible, commercial…" className="bg-white/5 border-white/10 text-white text-xs h-8" />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
