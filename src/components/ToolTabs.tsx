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
    <nav className="flex flex-col items-center gap-4 px-4 pb-4" aria-label="Outils disponibles">
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

      {/* Lien Audit Expert (anciennement Score SEO 200) */}
      <div className="flex justify-center">
        <Link to="/audit-expert">
          <Button
            variant="outline"
            className="gap-2 bg-gradient-to-r from-primary/10 to-primary/5 text-primary hover:from-primary/20 hover:to-primary/10 border-amber-400 border-2"
          >
            <FileSearch className="h-4 w-4" />
            <span>{auditExpertText[language]}</span>
          </Button>
        </Link>
      </div>
    </nav>
  );
}