import { PenLine } from 'lucide-react';
import { ContentArchitectSidebar } from './ContentArchitectSidebar';

interface ContentArchitectPromptPanelProps {
  trackedSiteId?: string;
  pageType: string;
  prompt: string;
  setPrompt: (v: string) => void;
  domain?: string;
  url: string;
  setUrl: (v: string) => void;
  onSelectPreset: (preset: any, site: any) => void;
}

export function ContentArchitectPromptPanel({
  trackedSiteId, pageType, prompt, setPrompt, domain, url, setUrl, onSelectPreset,
}: ContentArchitectPromptPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <PenLine className="w-3.5 h-3.5 text-white/50 stroke-[1.5]" />
        <h3 className="text-xs font-semibold text-white/70">Prompt & Presets</h3>
      </div>

      {/* Site presets — fills all remaining space */}
      <div className="flex-1 overflow-hidden">
        <ContentArchitectSidebar
          selectedSiteId={trackedSiteId}
          selectedPageType={pageType === 'landing' || pageType === 'product' || pageType === 'article' ? pageType : undefined}
          onSelectPreset={onSelectPreset}
        />
      </div>
    </div>
  );
}
