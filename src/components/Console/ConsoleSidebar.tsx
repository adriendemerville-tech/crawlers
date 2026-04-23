import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Settings, FileText, CheckSquare, Wallet, Lock, Crown, Bug,
  Network, Store, Blocks, FileBox, FileEdit, Anchor, Target, Globe,
  Shield, Code2, ChevronDown, Search, Sparkles,
} from 'lucide-react';

interface TrackedSite {
  id: string;
  domain: string;
  site_name?: string;
}

interface SidebarItem {
  value: string;
  label: string;
  icon: React.ElementType;
  proOnly?: boolean;
  adminOnly?: boolean;
  hideOnMobile?: boolean;
  beta?: boolean;
}

const translations = {
  fr: {
    tracking: 'SEO', geo: 'GEO', actionPlans: 'Plans d\'Action', correctiveCodes: '<Scripts>',
    wallet: 'Portefeuille', reports: 'Rapports', settings: 'Paramètres', creator: 'Créateur',
    allSites: 'Tous les sites',
  },
  en: {
    tracking: 'SEO', geo: 'GEO', actionPlans: 'Action Plans', correctiveCodes: '<Scripts>',
    wallet: 'Wallet', reports: 'Reports', settings: 'Settings', creator: 'Creator',
    allSites: 'All sites',
  },
  es: {
    tracking: 'SEO', geo: 'GEO', actionPlans: 'Planes de Acción', correctiveCodes: '<Scripts>',
    wallet: 'Billetera', reports: 'Informes', settings: 'Configuración', creator: 'Creador',
    allSites: 'Todos los sitios',
  },
};

interface ConsoleSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSiteSelect?: (siteId: string | null, domain: string | null) => void;
}

export function ConsoleSidebar({ activeTab, onTabChange, onSiteSelect }: ConsoleSidebarProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { isAgencyPro, planType } = useCredits();
  const { isAdmin, hasAdminAccess } = useAdmin();
  const isMobile = useIsMobile();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const isProUser = isAgencyPro || isAdmin;

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('tracked_sites')
      .select('id, domain, site_name')
      .eq('user_id', user.id)
      .order('domain')
      .then(({ data }) => {
        const s = (data as TrackedSite[]) || [];
        setSites(s);
        // Auto-select first site
        if (s.length > 0 && !selectedSiteId) {
          setSelectedSiteId(s[0].id);
          onSiteSelect?.(s[0].id, s[0].domain);
        }
      });
  }, [user]);

  const handleSiteChange = (siteId: string | null, domain: string | null) => {
    setSelectedSiteId(siteId);
    onSiteSelect?.(siteId, domain);
    setSelectorOpen(false);
  };

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  // Main navigation items
  const items: SidebarItem[] = [
    { value: 'tracking', label: t.tracking, icon: Search },
    { value: 'geo', label: t.geo, icon: Sparkles },
    { value: 'action-plans', label: t.actionPlans, icon: CheckSquare, hideOnMobile: true },
    { value: 'corrective-codes', label: t.correctiveCodes, icon: Code2, hideOnMobile: true },
    { value: 'crawls', label: 'Crawls', icon: Bug, proOnly: true, hideOnMobile: true },
    { value: 'drafts', label: 'Content', icon: FileEdit, hideOnMobile: true, beta: true },
    ...(isProUser ? [
      { value: 'sea-seo', label: 'SEA→SEO', icon: Target, hideOnMobile: true },
    ] : []),
    { value: 'indexation', label: 'Indexation', icon: Globe, hideOnMobile: true },
    { value: 'gmb', label: 'GMB', icon: Store },
    { value: 'marina', label: 'Marina', icon: Anchor, hideOnMobile: true },
    ...(!isProUser ? [
      { value: 'reports', label: t.reports, icon: FileText, hideOnMobile: true },
    ] : []),
    ...(isProUser ? [
      { value: 'reports-tab', label: t.reports, icon: FileBox, hideOnMobile: true },
    ] : []),
  ];

  // Bottom items: Pro Agency, Wallet, Settings, Creator, API
  const bottomItems: SidebarItem[] = [
    ...(isProUser ? [{
      value: 'wallet', label: planType === 'agency_premium' ? 'Pro Agency +' : 'Pro Agency',
      icon: Crown, hideOnMobile: true,
    }] : [
      { value: 'wallet', label: t.wallet, icon: Wallet, hideOnMobile: true },
    ]),
    ...(isAdmin ? [{ value: 'bundle', label: 'Bundle', icon: Blocks, adminOnly: true, hideOnMobile: true }] : []),
    { value: 'settings', label: t.settings, icon: Settings, hideOnMobile: true },
    ...(hasAdminAccess ? [{ value: 'admin', label: t.creator, icon: Shield }] : []),
  ];

  const renderItem = (item: SidebarItem) => {
    if (item.hideOnMobile && isMobile) return null;

    const isActive = activeTab === item.value;
    const isLocked = item.proOnly && !isProUser;
    const Icon = item.icon;
    const href = `/app/console?tab=${item.value}`;

    const content = (
      <>
        <Icon className={cn('h-4 w-4 shrink-0', item.value === 'wallet' && isProUser && 'text-yellow-500')} />
        <span className="flex-1 truncate">
          {item.beta && <span className="text-muted-foreground text-[9px] font-normal mr-1 uppercase">beta</span>}
          {item.value === 'wallet' && isProUser ? (
            <span className="font-semibold bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(30,90%,55%)] bg-clip-text text-transparent">
              {item.label}
            </span>
          ) : item.label}
        </span>
        {isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
      </>
    );

    const className = cn(
      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-thin transition-colors text-left',
      isActive
        ? 'bg-accent/60 text-foreground'
        : 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
      isLocked && 'opacity-40 cursor-not-allowed',
    );

    if (isLocked) {
      return (
        <div key={item.value}>
          <button disabled className={className}>{content}</button>
        </div>
      );
    }

    return (
      <div key={item.value}>
        <a
          href={href}
          onClick={(e) => {
            // Allow native behavior for modifier-clicks (new tab/window) and middle-click
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
            e.preventDefault();
            onTabChange(item.value);
          }}
          className={className}
        >
          {content}
        </a>
      </div>
    );
  };

  return (
    <aside className={cn(
      'shrink-0 border-r border-border/50 bg-background/50 flex flex-col',
      isMobile ? 'w-full border-r-0 border-b pb-2' : 'w-[200px] min-h-0 sticky top-0 self-start',
    )}>
      {/* Domain selector */}
      {!isMobile && sites.length > 0 && (
        <div className="px-2 pt-3 pb-1">
          <div className="relative">
            <button
              onClick={() => setSelectorOpen(!selectorOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-accent/20 hover:bg-accent/40 transition-colors text-left"
            >
              
              <span className="flex-1 truncate text-xs font-medium">
                {selectedSite ? selectedSite.domain.replace(/^www\./, '') : t.allSites}
              </span>
              <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', selectorOpen && 'rotate-180')} />
            </button>

            {selectorOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
                <button
                  onClick={() => handleSiteChange(null, null)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left',
                    !selectedSiteId ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent/40',
                  )}
                >
                  <Globe className="h-3 w-3 shrink-0" />
                  {t.allSites}
                </button>
                {sites.map(site => (
                  <button
                    key={site.id}
                    onClick={() => handleSiteChange(site.id, site.domain)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left',
                      selectedSiteId === site.id ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent/40',
                    )}
                  >
                    <span className="truncate">{site.domain.replace(/^www\./, '')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <nav className={cn(
        'flex-1 py-2 space-y-0.5 overflow-y-auto',
        isMobile ? 'flex gap-1 overflow-x-auto px-2 space-y-0' : 'px-2',
      )}>
        {isMobile ? (
          [...items.filter(i => !i.hideOnMobile), ...bottomItems.filter(i => !i.hideOnMobile)].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.value;
            return (
              <button
                key={item.value}
                onClick={() => onTabChange(item.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-thin whitespace-nowrap transition-colors',
                  isActive ? 'bg-accent text-foreground' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })
        ) : (
          items.map(renderItem)
        )}
      </nav>

      {!isMobile && (
        <div className="border-t border-border/40 px-2 py-2 space-y-0.5">
          {bottomItems.map(renderItem)}

          <button
            onClick={() => onTabChange('tracking-api')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-thin text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
          >
            <Network className="h-4 w-4 shrink-0" />
            <span>API</span>
          </button>
        </div>
      )}
    </aside>
  );
}
