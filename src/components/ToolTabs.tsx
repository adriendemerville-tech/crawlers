import { Bot, Gauge, Sparkles, Brain, FileSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export type ToolTab = 'crawlers' | 'pagespeed' | 'geo' | 'llm';

interface ToolTabsProps {
  activeTab: ToolTab;
  onTabChange: (tab: ToolTab) => void;
}

export function ToolTabs({ 
  activeTab, 
  onTabChange, 
}: ToolTabsProps) {
  const { t, language } = useLanguage();

  const auditExpertText = {
    fr: 'Audit Expert',
    en: 'Expert Audit',
    es: 'Auditoría Experta',
  };

  return (
    <nav className="flex flex-col items-center gap-2 px-4 pb-4" aria-label="Outils disponibles">
        <div className="inline-flex flex-wrap justify-center gap-1 rounded-lg border border-border bg-card p-1">
        <button
          onClick={() => onTabChange('crawlers')}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all sm:px-4 sm:py-2",
            activeTab === 'crawlers'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'crawlers' ? 'page' : undefined}
        >
          <Bot className="h-3.5 w-3.5" />
          <span>{t.tabs.crawlers}</span>
        </button>
        <button
          onClick={() => onTabChange('geo')}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all sm:px-4 sm:py-2",
            activeTab === 'geo'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'geo' ? 'page' : undefined}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t.tabs.geo}</span>
        </button>
        <button
          onClick={() => onTabChange('llm')}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all sm:px-4 sm:py-2",
            activeTab === 'llm'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'llm' ? 'page' : undefined}
        >
          <Brain className="h-3.5 w-3.5" />
          <span>{t.tabs.llm}</span>
        </button>
        <button
          onClick={() => onTabChange('pagespeed')}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all sm:px-4 sm:py-2",
            activeTab === 'pagespeed'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'pagespeed' ? 'page' : undefined}
        >
          <Gauge className="h-3.5 w-3.5" />
          <span>{t.tabs.pagespeed}</span>
        </button>
      </div>

      {/* Lien Audit Expert (anciennement Score SEO 200) */}
      <div className="flex justify-center">
        <Link to="/audit-expert">
          <Button
            variant="outline"
            size="lg"
            className="gap-2 bg-gradient-to-r from-primary/10 to-primary/5 text-primary hover:from-primary/20 hover:to-primary/10 border-amber-400 border-2 px-6 py-3 text-base"
          >
            <FileSearch className="h-5 w-5" />
            <span className="font-bold">{auditExpertText[language]}</span>
          </Button>
        </Link>
      </div>
    </nav>
  );
}