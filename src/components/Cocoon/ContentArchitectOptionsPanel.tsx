import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

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
}

export function ContentArchitectOptionsPanel({
  competitorUrl, setCompetitorUrl, ctaLink, setCtaLink, photoUrl, setPhotoUrl, tone, setTone, autoFilled,
}: ContentArchitectOptionsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/10">
        <h3 className="text-xs font-semibold text-white/70">⚙️ Options avancées</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
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
