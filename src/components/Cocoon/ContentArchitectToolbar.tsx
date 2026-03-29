import { PenLine, Layers, ImageIcon, Settings } from 'lucide-react';

export type PanelId = 'prompt' | 'structure' | 'images' | 'options';

interface ToolbarItem {
  id: PanelId;
  icon: typeof PenLine;
  label: string;
  requiresResult?: boolean;
}

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: 'prompt', icon: PenLine, label: 'Prompt' },
  { id: 'structure', icon: Layers, label: 'Structure' },
  { id: 'images', icon: ImageIcon, label: 'Images' },
  { id: 'options', icon: Settings, label: 'Options' },
];

interface ContentArchitectToolbarProps {
  activePanel: PanelId | null;
  onTogglePanel: (id: PanelId) => void;
  hasResult: boolean;
}

export function ContentArchitectToolbar({ activePanel, onTogglePanel, hasResult }: ContentArchitectToolbarProps) {
  return (
    <div className="w-[56px] shrink-0 border-r border-white/10 flex flex-col items-center py-3 gap-1 bg-[#0a0616]">
      {TOOLBAR_ITEMS.map(item => {
        const Icon = item.icon;
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTogglePanel(item.id)}
            className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-150 ${
              isActive
                ? 'bg-[#fbbf24]/15 text-[#fbbf24] shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                : 'text-white/30 hover:bg-white/5 hover:text-white/60'
            }`}
            title={item.label}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[8px] leading-none font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
