import { PenLine, Layers, ImageIcon, Settings, Braces, FileEdit, BookOpen } from 'lucide-react';

export type PanelId = 'prompt' | 'structure' | 'images' | 'structured-data' | 'draft' | 'library' | 'options';

interface ToolbarItem {
  id: PanelId;
  icon: typeof PenLine;
  label: string;
}

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: 'prompt', icon: PenLine, label: 'Prompt' },
  { id: 'structure', icon: Layers, label: 'Structure' },
  { id: 'structured-data', icon: Braces, label: 'Données' },
  { id: 'images', icon: ImageIcon, label: 'Images' },
  { id: 'draft', icon: FileEdit, label: 'Brouillon' },
  { id: 'library', icon: BookOpen, label: 'Biblio.' },
  { id: 'options', icon: Settings, label: 'Options' },
];

interface ContentArchitectToolbarProps {
  activePanel: PanelId | null;
  onTogglePanel: (id: PanelId) => void;
  hasResult: boolean;
}

export function ContentArchitectToolbar({ activePanel, onTogglePanel, hasResult }: ContentArchitectToolbarProps) {
  return (
    <div className="w-[56px] shrink-0 border-r border-white/10 flex flex-col items-center py-3 gap-0.5 bg-[#0a0616]">
      {TOOLBAR_ITEMS.map(item => {
        const Icon = item.icon;
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTogglePanel(item.id)}
            className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-[3px] transition-all duration-150 ${
              isActive
                ? 'bg-[#fbbf24]/15 text-[#fbbf24] shadow-[0_0_12px_rgba(251,191,36,0.1)]'
                : 'text-white/30 hover:bg-white/5 hover:text-white/60'
            }`}
            title={item.label}
          >
            <Icon className="w-[15px] h-[15px] stroke-[1.5]" />
            <span className="text-[7px] leading-none font-medium tracking-wide">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
