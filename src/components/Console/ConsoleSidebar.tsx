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
  Shield, Code2, ChevronDown, Search, Sparkles, Database, SlidersHorizontal,
  Plus, Loader2, Check, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConsoleViewMode } from '@/contexts/ConsoleViewModeContext';

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
  /** When true, hidden in simplified (non-advanced) view. */
  advancedOnly?: boolean;
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
  const { advanced, toggle } = useConsoleViewMode();

  const [sites, setSites] = useState<TrackedSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [gscBigQueryHidden, setGscBigQueryHidden] = useState(false);
  const [addHover, setAddHover] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddDomain = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !newDomain.trim() || adding) return;
    setAdding(true);
    try {
      // 1. Probe URL
      const { data: probe, error: probeErr } = await supabase.functions.invoke('check-url-reachable', {
        body: { url: newDomain.trim() },
      });
      if (probeErr || !probe?.ok) {
        toast.error('Site injoignable', { description: probe?.error || 'Vérifiez l\'URL' });
        setAdding(false);
        return;
      }
      const hostname = (probe.hostname as string).replace(/^www\./, '');

      // 2. Check duplicate
      const existing = sites.find(s => s.domain.replace(/^www\./, '') === hostname);
      if (existing) {
        handleSiteChange(existing.id, existing.domain);
        setNewDomain('');
        setAddHover(false);
        setAdding(false);
        return;
      }

      // 3. Insert
      const { data: created, error: insErr } = await supabase
        .from('tracked_sites')
        .insert({ user_id: user.id, domain: hostname, site_name: hostname })
        .select('id, domain, site_name')
        .single();
      if (insErr || !created) {
        toast.error('Erreur lors de l\'ajout', { description: insErr?.message });
        setAdding(false);
        return;
      }
      setSites(prev => [...prev, created as TrackedSite].sort((a, b) => a.domain.localeCompare(b.domain)));
      handleSiteChange(created.id, created.domain);
      toast.success('Site ajouté au suivi');
      setNewDomain('');
      setAddHover(false);
    } finally {
      setAdding(false);
    }
  };

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

  // Read global admin flag to hide GSC BigQuery tab from non-admins
  useEffect(() => {
    if (!user) return;
    supabase
      .from('admin_dashboard_config')
      .select('card_order')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.card_order && typeof data.card_order === 'object' && !Array.isArray(data.card_order)) {
          const config = data.card_order as Record<string, unknown>;
          setGscBigQueryHidden(!!config.gsc_bigquery_hidden);
        }
      });
  }, [user]);

  // Liste des onglets cachés en vue simplifiée — doit rester synchro avec advancedOnly ci-dessous.
  const ADVANCED_ONLY_TABS = [
    'corrective-codes', 'crawls', 'sea-seo', 'indexation', 'gsc-bigquery',
    'marina', 'bundle', 'tracking-api',
  ];

  // Si l'utilisateur passe en vue simplifiée alors qu'il est sur un onglet technique, on le ramène sur SEO.
  useEffect(() => {
    if (!advanced && ADVANCED_ONLY_TABS.includes(activeTab)) {
      onTabChange('tracking');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanced]);

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
    { value: 'corrective-codes', label: t.correctiveCodes, icon: Code2, hideOnMobile: true, advancedOnly: true },
    { value: 'crawls', label: 'Crawls', icon: Bug, proOnly: true, hideOnMobile: true, advancedOnly: true },
    { value: 'drafts', label: 'Content', icon: FileEdit, hideOnMobile: true, beta: true },
    ...(isProUser ? [
      { value: 'sea-seo', label: 'SEA→SEO', icon: Target, hideOnMobile: true, advancedOnly: true },
    ] : []),
    { value: 'indexation', label: 'Indexation', icon: Globe, hideOnMobile: true, advancedOnly: true },
    ...(isProUser && (!gscBigQueryHidden || isAdmin) ? [
      { value: 'gsc-bigquery', label: 'GSC BQ', icon: Database, hideOnMobile: true, beta: true, advancedOnly: true },
    ] : []),
    { value: 'gmb', label: 'GMB', icon: Store },
    { value: 'marina', label: 'Marina', icon: Anchor, hideOnMobile: true, advancedOnly: true },
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
    ...(isAdmin ? [{ value: 'bundle', label: 'Bundle', icon: Blocks, adminOnly: true, hideOnMobile: true, advancedOnly: true }] : []),
    { value: 'settings', label: t.settings, icon: Settings, hideOnMobile: true },
    ...(hasAdminAccess ? [{ value: 'admin', label: t.creator, icon: Shield }] : []),
  ];

  const renderItem = (item: SidebarItem) => {
    if (item.hideOnMobile && isMobile) return null;
    if (item.advancedOnly && !advanced) return null;

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
      isMobile
        ? 'w-full border-r-0 border-b pb-2'
        // Desktop : sticky pleine hauteur pour garder sous-menu + sélecteur de domaine fixes au scroll
        : 'w-[200px] sticky top-0 self-start h-screen overflow-hidden',
    )}>
      {/* Domain selector */}
      {!isMobile && sites.length > 0 && (
        <div className="px-2 pt-0 pb-1 space-y-1">
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
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                <div className="py-1 max-h-60 overflow-y-auto">
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
                {/* Add domain — hover reveals input */}
                <div
                  className="border-t border-border/60"
                  onMouseEnter={() => setAddHover(true)}
                  onMouseLeave={() => { if (!newDomain && !adding) setAddHover(false); }}
                >
                  {!addHover ? (
                    <button
                      type="button"
                      onClick={() => setAddHover(true)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/40 transition-colors"
                    >
                      <Plus className="h-3 w-3 shrink-0" />
                      Ajouter un domaine
                    </button>
                  ) : (
                    <form onSubmit={handleAddDomain} className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        autoFocus
                        type="text"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') { setNewDomain(''); setAddHover(false); }
                        }}
                        placeholder="exemple.com"
                        disabled={adding}
                        className="flex-1 min-w-0 h-7 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        type="submit"
                        disabled={adding || !newDomain.trim()}
                        aria-label="Valider"
                        className="h-7 w-7 flex items-center justify-center rounded border border-border hover:bg-accent/40 disabled:opacity-40"
                      >
                        {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNewDomain(''); setAddHover(false); }}
                        aria-label="Annuler"
                        className="h-7 w-7 flex items-center justify-center rounded border border-border hover:bg-accent/40"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* View mode toggle — juste sous le sélecteur, sans picto */}
          <button
            type="button"
            onClick={toggle}
            aria-pressed={advanced}
            title={advanced ? 'Passer en vue simplifiée' : 'Passer en vue avancée'}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-thin text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
          >
            <span className="flex-1 text-left truncate">
              {advanced ? 'Vue avancée' : 'Vue simplifiée'}
            </span>
            <span
              className={cn(
                'relative inline-flex h-4 w-7 items-center rounded-full border transition-colors',
                advanced ? 'border-foreground/70' : 'border-border',
              )}
            >
              <span
                className={cn(
                  'inline-block h-2.5 w-2.5 rounded-full bg-foreground transition-transform',
                  advanced ? 'translate-x-3.5' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>
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
            const href = `/app/console?tab=${item.value}`;
            return (
              <a
                key={item.value}
                href={href}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
                  e.preventDefault();
                  onTabChange(item.value);
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-thin whitespace-nowrap transition-colors',
                  isActive ? 'bg-accent text-foreground' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </a>
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
            href="/app/console?tab=tracking"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
              e.preventDefault();
              onTabChange('tracking-api');
            }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-thin text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors',
              !advanced && 'hidden',
            )}
          >
            <Network className="h-4 w-4 shrink-0" />
            <span>API</span>
          </a>
        </div>
      )}
    </aside>
  );
}
