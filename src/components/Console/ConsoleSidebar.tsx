import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAdmin } from '@/hooks/useAdmin';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Settings, FileText, CheckSquare, Wallet, Lock, Radar, Crown, Bug,
  Network, Store, Blocks, FileBox, FileEdit, Anchor, Target, Globe,
  ChevronDown, ChevronUp, Shield, Search, Code2,
} from 'lucide-react';

interface TrackedSite {
  id: string;
  domain: string;
  site_name?: string;
}

interface TrackedPage {
  url: string;
  slug: string;
  domain: string;
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
    searchSlug: 'Rechercher /',
  },
  en: {
    tracking: 'My Sites', actionPlans: 'Action Plans', correctiveCodes: '<Scripts>',
    wallet: 'Wallet', reports: 'Reports', settings: 'Settings', creator: 'Creator',
    searchSlug: 'Search /',
  },
  es: {
    tracking: 'Mis sitios', actionPlans: 'Planes de Acción', correctiveCodes: '<Scripts>',
    wallet: 'Billetera', reports: 'Informes', settings: 'Configuración', creator: 'Creador',
    searchSlug: 'Buscar /',
  },
};

interface ConsoleSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSiteSelect?: (siteId: string, domain: string) => void;
  onPageSelect?: (slug: string) => void;
}

export function ConsoleSidebar({ activeTab, onTabChange, onSiteSelect, onPageSelect }: ConsoleSidebarProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { isAgencyPro, planType } = useCredits();
  const { isAdmin, hasAdminAccess } = useAdmin();
  const isMobile = useIsMobile();
  const t = translations[language as keyof typeof translations] || translations.fr;
  const isProUser = isAgencyPro || isAdmin;

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [pages, setPages] = useState<TrackedPage[]>([]);
  const [expandedTab, setExpandedTab] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [slugSearch, setSlugSearch] = useState('');

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

  useEffect(() => {
    if (!selectedSiteId) { setPages([]); return; }
    const site = sites.find(s => s.id === selectedSiteId);
    if (!site) return;

    supabase
      .from('analyzed_urls')
      .select('url, domain')
      .eq('domain', site.domain)
      .order('last_analyzed_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        const mapped = (data || []).map(d => {
          try {
            const u = new URL(d.url.startsWith('http') ? d.url : `https://${d.url}`);
            return { url: d.url, slug: u.pathname, domain: d.domain };
          } catch {
            return { url: d.url, slug: d.url, domain: d.domain };
          }
        });
        setPages(mapped);
      });
  }, [selectedSiteId, sites]);

  const filteredPages = useMemo(() => {
    if (!slugSearch) return pages;
    const q = slugSearch.replace(/^\//, '').toLowerCase();
    return pages.filter(p => p.slug.toLowerCase().includes(q));
  }, [pages, slugSearch]);

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
      setExpandedSite(null);
      setSlugSearch('');
    } else {
      setExpandedTab(null);
      setExpandedSite(null);
    }
  };

  const handleSiteClick = (site: TrackedSite) => {
    setSelectedSiteId(site.id);
    onSiteSelect?.(site.id, site.domain);
    if (expandedSite === site.id) {
      setExpandedSite(null);
      setSlugSearch('');
    } else {
      setExpandedSite(site.id);
      setSlugSearch('');
    }
  };

  const handlePageClick = (page: TrackedPage) => {
    onPageSelect?.(page.slug);
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
            {sites.map(site => {
              const isSiteExpanded = expandedSite === site.id;
              return (
                <div key={site.id}>
                  <button
                    onClick={() => handleSiteClick(site)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-thin transition-colors text-left',
                      selectedSiteId === site.id
                        ? 'text-foreground bg-accent/40'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/20',
                    )}
                  >
                    <span className="flex-1 truncate">{site.domain}</span>
                    {isSiteExpanded
                      ? <ChevronUp className="h-2.5 w-2.5 text-muted-foreground" />
                      : <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                    }
                  </button>

                  {isSiteExpanded && (
                    <div className="ml-3 mt-0.5 border-l border-border/30 pl-2 space-y-0.5">
                      {pages.length >= 10 && (
                        <div className="py-1">
                          <div className="relative">
                            <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                              value={slugSearch}
                              onChange={e => setSlugSearch(e.target.value)}
                              placeholder={t.searchSlug}
                              className="h-6 pl-6 pr-2 text-[11px] bg-background/50 border-border/40"
                            />
                          </div>
                        </div>
                      )}
                      {pages.length === 0 && (
                        <span className="text-[10px] text-muted-foreground px-2 py-1 block italic">
                          Aucune page analysée
                        </span>
                      )}
                      <div className="max-h-40 overflow-y-auto space-y-0.5">
                        {filteredPages.slice(0, 50).map((page, idx) => (
                          <button
                            key={idx}
                            onClick={() => handlePageClick(page)}
                            className="w-full text-left px-2 py-1 rounded text-[11px] font-thin text-muted-foreground hover:text-foreground hover:bg-accent/20 truncate transition-colors"
                            title={page.url}
                          >
                            {page.slug}
                          </button>
                        ))}
                        {filteredPages.length === 0 && slugSearch && (
                          <span className="text-[10px] text-muted-foreground px-2 py-1 block italic">
                            Aucun résultat
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
