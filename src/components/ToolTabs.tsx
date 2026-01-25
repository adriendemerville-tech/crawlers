import { Bot, Gauge, Sparkles, Brain, Zap, Loader2, FileSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export type ToolTab = 'crawlers' | 'pagespeed' | 'geo' | 'llm';

interface ToolTabsProps {
  activeTab: ToolTab;
  onTabChange: (tab: ToolTab) => void;
  onFullAudit?: () => void;
  isAuditLoading?: boolean;
  showAuditButton?: boolean;
  isAuditActive?: boolean;
}

export function ToolTabs({ 
  activeTab, 
  onTabChange, 
  onFullAudit, 
  isAuditLoading = false,
  showAuditButton = false,
  isAuditActive = false
}: ToolTabsProps) {
  const { t, language } = useLanguage();

  const auditButtonText = {
    fr: isAuditLoading ? 'Audit en cours...' : 'Audit Complet IA',
    en: isAuditLoading ? 'Audit in progress...' : 'Full AI Audit',
    es: isAuditLoading ? 'Auditoría en curso...' : 'Auditoría IA Completa',
  };

  return (
    <nav className="flex flex-col items-center gap-4 px-4 pb-4" aria-label="Outils disponibles">
      <div className="inline-flex flex-wrap justify-center gap-1 rounded-xl border border-border bg-card p-1.5 card-shadow">
        <button
          onClick={() => onTabChange('crawlers')}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:px-6 sm:py-3",
            activeTab === 'crawlers' && !isAuditActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'crawlers' && !isAuditActive ? 'page' : undefined}
        >
          <Bot className="h-4 w-4" />
          <span>{t.tabs.crawlers}</span>
        </button>
        <button
          onClick={() => onTabChange('geo')}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:px-6 sm:py-3",
            activeTab === 'geo' && !isAuditActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'geo' && !isAuditActive ? 'page' : undefined}
        >
          <Sparkles className="h-4 w-4" />
          <span>{t.tabs.geo}</span>
        </button>
        <button
          onClick={() => onTabChange('llm')}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:px-6 sm:py-3",
            activeTab === 'llm' && !isAuditActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'llm' && !isAuditActive ? 'page' : undefined}
        >
          <Brain className="h-4 w-4" />
          <span>{t.tabs.llm}</span>
        </button>
        <button
          onClick={() => onTabChange('pagespeed')}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:px-6 sm:py-3",
            activeTab === 'pagespeed' && !isAuditActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          aria-current={activeTab === 'pagespeed' && !isAuditActive ? 'page' : undefined}
        >
          <Gauge className="h-4 w-4" />
          <span>{t.tabs.pagespeed}</span>
        </button>
      </div>

      {/* Boutons d'action en dessous des onglets */}
      <div className="flex flex-wrap justify-center gap-2">
        {/* Bouton Audit Complet IA */}
        {showAuditButton && onFullAudit && (
          <Button
            onClick={onFullAudit}
            disabled={isAuditLoading}
            variant={isAuditActive ? "default" : "outline"}
            className={cn(
              "gap-2 transition-all",
              isAuditActive && "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
          >
            {isAuditLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {auditButtonText[language]}
          </Button>
        )}

        {/* Lien Score SEO 200 */}
        <Link to="/audit-expert">
          <Button
            variant="outline"
            className="gap-2 bg-gradient-to-r from-primary/10 to-primary/5 text-primary hover:from-primary/20 hover:to-primary/10 border-primary/20"
          >
            <FileSearch className="h-4 w-4" />
            <span>Score SEO 200</span>
          </Button>
        </Link>
      </div>
    </nav>
  );
}