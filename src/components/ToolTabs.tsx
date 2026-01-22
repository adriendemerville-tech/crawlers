import { Bot, Gauge, Sparkles, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export type ToolTab = 'crawlers' | 'pagespeed' | 'geo' | 'llm';

interface ToolTabsProps {
  activeTab: ToolTab;
  onTabChange: (tab: ToolTab) => void;
}

export function ToolTabs({ activeTab, onTabChange }: ToolTabsProps) {
  const { t } = useLanguage();

  return (
    <nav className="flex justify-center px-4 pb-8" aria-label="Outils disponibles">
      <div className="inline-flex flex-wrap justify-center gap-1 rounded-xl border border-border bg-card p-1.5 card-shadow">
        <button
          onClick={() => onTabChange('crawlers')}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:px-6 sm:py-3",
            activeTab === 'crawlers'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'crawlers' ? 'page' : undefined}
        >
          <Bot className="h-4 w-4" />
          <span>{t.tabs.crawlers}</span>
        </button>
        <button
          onClick={() => onTabChange('geo')}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:px-6 sm:py-3",
            activeTab === 'geo'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'geo' ? 'page' : undefined}
        >
          <Sparkles className="h-4 w-4" />
          <span>{t.tabs.geo}</span>
        </button>
        <button
          onClick={() => onTabChange('llm')}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:px-6 sm:py-3",
            activeTab === 'llm'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'llm' ? 'page' : undefined}
        >
          <Brain className="h-4 w-4" />
          <span>{t.tabs.llm}</span>
        </button>
        <button
          onClick={() => onTabChange('pagespeed')}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:px-6 sm:py-3",
            activeTab === 'pagespeed'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'pagespeed' ? 'page' : undefined}
        >
          <Gauge className="h-4 w-4" />
          <span>{t.tabs.pagespeed}</span>
        </button>
      </div>
    </nav>
  );
}