import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Settings, FileText, CheckSquare, Wallet, Lock, Radar, Crown, Bug,
  Network, Store, Blocks, FileBox, FileEdit, Anchor, Target, Globe,
  ChevronDown, ChevronUp, Shield, Code2,
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
  hasSites?: boolean;
}

const translations = {
  fr: {
    tracking: 'Mes sites', actionPlans: 'Plans d\'Action', correctiveCodes: '<Scripts>',
    wallet: 'Portefeuille', reports: 'Rapports', settings: 'Paramètres', creator: 'Créateur',
  },
  en: {
    tracking: 'My Sites', actionPlans: 'Action Plans', correctiveCodes: '<Scripts>',
    wallet: 'Wallet', reports: 'Reports', settings: 'Settings', creator: 'Creator',
  },
  es: {
    tracking: 'Mis sitios', actionPlans: 'Planes de Acción', correctiveCodes: '<Scripts>',
    wallet: 'Billetera', reports: 'Informes', settings: 'Configuración', creator: 'Creador',
  },
};

interface ConsoleSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSiteSelect?: (siteId: string, domain: string) => void;
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
  const [expandedTab, setExpandedTab] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('tracked_sites')
      .select('id, domain, site_name')
      .eq('user_id', user.id)
      .order('domain')
      .then(({ data }) => {
        setSites((data as TrackedSite[]) || []);
      });
  }, [user]);

  const items: SidebarItem[] = [
    ...(isProUser ? [{
      value: 'wallet', label: planType === 'agency_premium' ? 'Pro Agency +' : 'Pro Agency',
      icon: Crown, hideOnMobile: true, hasSites: false,
    }] : []),
    { value: 'tracking', label: t.tracking, icon: Radar, hasSites: false },
    { value: 'action-plans', label: t.actionPlans, icon: CheckSquare, hideOnMobile: true, hasSites: true },
    { value: 'corrective-codes', label: t.correctiveCodes, icon: Code2, hideOnMobile: true, hasSites: true },
    { value: 'crawls', label: 'Crawls', icon: Bug, proOnly: true, hideOnMobile: true, hasSites: true },
    { value: 'drafts', label: 'Content', icon: FileEdit, hideOnMobile: true, beta: true, hasSites: true },
    ...(isProUser ? [
      { value: 'reports-tab', label: t.reports, icon: FileBox, hideOnMobile: true, hasSites: true },
      { value: 'sea-seo', label: 'SEA→SEO', icon: Target, hideOnMobile: true, hasSites: true },
    ] : []),
    { value: 'indexation', label: 'Indexation', icon: Globe, hideOnMobile: true, hasSites: true },
    { value: 'gmb', label: 'GMB', icon: Store, proOnly: !isProUser ? false : undefined as unknown as boolean, hasSites: true },
    { value: 'marina', label: 'Marina', icon: Anchor, hideOnMobile: true, hasSites: true },
    ...(isAdmin ? [{ value: 'bundle', label: 'Bundle', icon: Blocks, adminOnly: true, hideOnMobile: true, hasSites: false }] : []),
    ...(!isProUser ? [
      { value: 'reports', label: t.reports, icon: FileText, hideOnMobile: true, hasSites: false },
      { value: 'wallet', label: t.wallet, icon: Wallet, hideOnMobile: true, hasSites: false },
    ] : []),
  ];

  const bottomItems: SidebarItem[] = [
    { value: 'settings', label: t.settings, icon: Settings, hideOnMobile: true, hasSites: false },
    ...(hasAdminAccess ? [{ value: 'admin', label: t.creator, icon: Shield, hasSites: false }] : []),
  ];

  const handleTabClick = (item: SidebarItem) => {
    onTabChange(item.value);
    if (item.hasSites && sites.length > 1) {
      setExpandedTab(expandedTab === item.value ? null : item.value);
    } else {
      setExpandedTab(null);
    }
  };

  const handleSiteClick = (site: TrackedSite) => {
    setSelectedSiteId(site.id);
    onSiteSelect?.(site.id, site.domain);
  };

  const renderItem = (item: SidebarItem) => {
    if (item.hideOnMobile && isMobile) return null;

    const isActive = activeTab === item.value;
    const isLocked = item.proOnly && !isProUser;
    const isExpanded = expandedTab === item.value;
    const Icon = item.icon;

    return (
      <div key={item.value}>
        <button
          onClick={() => !isLocked && handleTabClick(item)}
          disabled={isLocked}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-thin transition-colors text-left',
            isActive
              ? 'bg-accent/60 text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/30',
            isLocked && 'opacity-40 cursor-not-allowed',
          )}
        >
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
          {item.hasSites && sites.length > 1 && !isLocked && (
            isExpanded
              ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
              : <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </button>

        {isExpanded && sites.length > 1 && (
          <div className="ml-4 mt-0.5 border-l border-border/40 pl-2 space-y-0.5">
            {sites.map(site => (
              <button
                key={site.id}
                onClick={() => handleSiteClick(site)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-thin transition-colors text-left',
                  selectedSiteId === site.id
                    ? 'text-foreground bg-accent/40'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/20',
                )}
              >
                <span className="flex-1 truncate">{site.domain}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className={cn(
      'shrink-0 border-r border-border/50 bg-background/50 flex flex-col',
      isMobile ? 'w-full border-r-0 border-b pb-2' : 'w-[200px] min-h-0 sticky top-0 self-start',
    )}>
      <nav className={cn(
        'flex-1 py-2 space-y-0.5 overflow-y-auto',
        isMobile ? 'flex gap-1 overflow-x-auto px-2 space-y-0' : 'px-2',
      )}>
        {isMobile ? (
          items.filter(i => !i.hideOnMobile).map(item => {
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

          <a
            href="/app/api"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-thin text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
          >
            <Network className="h-4 w-4 shrink-0" />
            <span>API</span>
          </a>
        </div>
      )}
    </aside>
  );
}
