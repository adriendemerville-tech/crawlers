import { PenLine, Layers, ImageIcon, Settings, Braces, FileEdit, BookOpen, ClipboardList, Mic, Zap } from 'lucide-react';

export type PanelId = 'prompt' | 'structure' | 'images' | 'structured-data' | 'draft' | 'library' | 'tasks' | 'options' | 'voice' | 'quickwins';

interface ToolbarItem {
  id: PanelId;
  icon: typeof PenLine;
  label: string;
}

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { id: 'quickwins', icon: Zap, label: 'Quick Wins' },
  { id: 'prompt', icon: PenLine, label: 'Prompt' },
  { id: 'structure', icon: Layers, label: 'Structure' },
  { id: 'structured-data', icon: Braces, label: 'Données' },
  { id: 'images', icon: ImageIcon, label: 'Images' },
  { id: 'draft', icon: FileEdit, label: 'Brouillon' },
  { id: 'library', icon: BookOpen, label: 'Biblio.' },
  { id: 'tasks', icon: ClipboardList, label: 'Tâches' },
  { id: 'voice', icon: Mic, label: 'Voice' },
  { id: 'options', icon: Settings, label: 'Options' },
];

interface ContentArchitectToolbarProps {
  activePanel: PanelId | null;
  onTogglePanel: (id: PanelId) => void;
  hasResult: boolean;
  colorTheme?: 'cocoon' | 'green';
}

const themes = {
  cocoon: {
    bg: 'bg-[#0f172a]',
    active: 'bg-teal-500/15 text-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.12)]',
    inactive: 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-300',
    border: 'border-slate-700/60',
  },
  green: {
    bg: 'bg-[#0f172a]',
    active: 'bg-teal-500/15 text-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.12)]',
    inactive: 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-300',
    border: 'border-slate-700/60',
  },
};

export function ContentArchitectToolbar({ activePanel, onTogglePanel, hasResult, colorTheme = 'cocoon' }: ContentArchitectToolbarProps) {
  const t = themes[colorTheme];
  return (
    <div className={`w-[56px] shrink-0 border-r ${t.border} flex flex-col items-center py-3 gap-0.5 ${t.bg}`}>
      {TOOLBAR_ITEMS.map(item => {
        const Icon = item.icon;
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTogglePanel(item.id)}
            className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-[3px] transition-all duration-150 ${
              isActive ? t.active : t.inactive
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
