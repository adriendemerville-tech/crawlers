import { Lock, Image as ImageIcon } from 'lucide-react';
import { ImageColumn, type GeneratedImageItem } from './ImageStylePicker';

interface ContentArchitectImagePanelProps {
  workflowStep: number;
  pageType: string;
  trackedSiteId?: string;
  targetUrl: string;
  identityCard: Record<string, any> | null;
  generatedImages: GeneratedImageItem[];
  imageIterations: number;
  onImageGenerated: (dataUri: string, style: any) => void;
  onImageRemoved: (index: number) => void;
  onImagePlacement: (index: number, placement: 'header' | 'body') => void;
}

export function ContentArchitectImagePanel({
  workflowStep, pageType, trackedSiteId, targetUrl, identityCard,
  generatedImages, imageIterations, onImageGenerated, onImageRemoved, onImagePlacement,
}: ContentArchitectImagePanelProps) {
  if (workflowStep < 3) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5 text-white/15" />
          </div>
          <p className="text-xs text-white/25">Génération d'images</p>
          <p className="text-[10px] text-white/15">Disponible après la génération du contenu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <ImageIcon className="w-3.5 h-3.5 text-white/50 stroke-[1.5]" />
        <h3 className="text-xs font-semibold text-white/70">Images</h3>
      </div>
      <div className="flex-1 overflow-hidden">
        <ImageColumn
          pageType={pageType}
          trackedSiteId={trackedSiteId}
          targetUrl={targetUrl}
          identityCard={identityCard}
          generatedImages={generatedImages}
          iterationsUsed={imageIterations}
          onImageGenerated={onImageGenerated}
          onImageRemoved={onImageRemoved}
          onImagePlacement={onImagePlacement}
        />
      </div>
    </div>
  );
}
