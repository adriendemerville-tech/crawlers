import { useState, useRef, useEffect, useCallback } from 'react';
import { FolderSearch, Search, Loader2, X, FileText, Globe, Network, BarChart3, Shield, Bot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReportResult {
  id: string;
  type: 'seo' | 'geo' | 'strategic' | 'crawl' | 'cocoon' | 'marina' | 'eeat' | 'technical';
  label: string;
  domain: string;
  date: string;
  summary?: string;
}

interface ChatReportSearchProps {
  userId: string;
  onSelect: (report: ReportResult) => void;
}

const TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; label: string }> = {
  seo: { icon: BarChart3, color: 'text-blue-500', label: 'SEO' },
  geo: { icon: Globe, color: 'text-violet-500', label: 'GEO' },
  strategic: { icon: BarChart3, color: 'text-amber-500', label: 'Stratégique' },
  crawl: { icon: Network, color: 'text-emerald-500', label: 'Crawl' },
  cocoon: { icon: Network, color: 'text-teal-500', label: 'Cocoon' },
  marina: { icon: FileText, color: 'text-indigo-500', label: 'Marina' },
  eeat: { icon: Shield, color: 'text-orange-500', label: 'E-E-A-T' },
  technical: { icon: FileText, color: 'text-gray-500', label: 'Technique' },
};

export function ChatReportSearch({ userId, onSelect }: ChatReportSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReportResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const searchReports = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const lower = q.toLowerCase().trim();
      const allResults: ReportResult[] = [];

      // Determine type filter from keywords
      const typeFilters: string[] = [];
      if (/crawl/i.test(lower)) typeFilters.push('crawl');
      if (/seo/i.test(lower) && !/geo/i.test(lower)) typeFilters.push('seo', 'technical');
      if (/geo/i.test(lower)) typeFilters.push('geo', 'strategic');
      if (/cocoon|cocon|maillage/i.test(lower)) typeFilters.push('cocoon');
      if (/marina|rapport/i.test(lower)) typeFilters.push('marina');
      if (/eeat|e-e-a-t/i.test(lower)) typeFilters.push('eeat');
      if (/strat/i.test(lower)) typeFilters.push('strategic');

      // Extract possible domain from query (remove type keywords)
      const domainPart = lower
        .replace(/\b(crawl|seo|geo|cocoon|cocon|marina|eeat|e-e-a-t|rapport|audit|maillage|strat[eé]gique?)\b/gi, '')
        .trim();

      // 1. audit_raw_data
      let auditQuery = supabase
        .from('audit_raw_data')
        .select('id, audit_type, domain, url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (domainPart) {
        auditQuery = auditQuery.ilike('domain', `%${domainPart}%`);
      }
      if (typeFilters.length > 0 && !domainPart) {
        const auditTypes = typeFilters.flatMap(t => {
          if (t === 'seo') return ['seo', 'technical'];
          if (t === 'geo') return ['geo', 'strategic', 'strategic_parallel'];
          if (t === 'strategic') return ['strategic', 'strategic_parallel'];
          if (t === 'eeat') return ['eeat'];
          if (t === 'technical') return ['technical'];
          return [];
        });
        if (auditTypes.length > 0) {
          auditQuery = auditQuery.in('audit_type', [...new Set(auditTypes)]);
        }
      }

      const { data: audits } = await auditQuery;
      if (audits) {
        for (const a of audits) {
          const t = a.audit_type === 'strategic' || a.audit_type === 'strategic_parallel' ? 'strategic'
            : a.audit_type === 'eeat' ? 'eeat'
            : a.audit_type === 'geo' ? 'geo'
            : a.audit_type === 'technical' ? 'technical'
            : 'seo';
          allResults.push({
            id: a.id,
            type: t as ReportResult['type'],
            label: `Audit ${TYPE_CONFIG[t]?.label || t}`,
            domain: a.domain,
            date: a.created_at,
          });
        }
      }

      // 2. site_crawls
      if (!typeFilters.length || typeFilters.includes('crawl')) {
        let crawlQuery = supabase
          .from('site_crawls')
          .select('id, domain, created_at, total_pages, status')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(10);

        if (domainPart) {
          crawlQuery = crawlQuery.ilike('domain', `%${domainPart}%`);
        }

        const { data: crawls } = await crawlQuery;
        if (crawls) {
          for (const c of crawls) {
            allResults.push({
              id: c.id,
              type: 'crawl',
              label: `Crawl (${c.total_pages || '?'} pages)`,
              domain: c.domain,
              date: c.created_at,
            });
          }
        }
      }

      // 3. cocoon_sessions
      if (!typeFilters.length || typeFilters.includes('cocoon')) {
        let cocoonQuery = supabase
          .from('cocoon_sessions')
          .select('id, domain, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (domainPart) {
          cocoonQuery = cocoonQuery.ilike('domain', `%${domainPart}%`);
        }

        const { data: cocoons } = await cocoonQuery;
        if (cocoons) {
          for (const c of cocoons) {
            allResults.push({
              id: c.id,
              type: 'cocoon',
              label: 'Analyse Cocoon',
              domain: c.domain,
              date: c.created_at,
            });
          }
        }
      }

      // Sort by date and limit to 10
      allResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setResults(allResults.slice(0, 10));
    } catch (e) {
      console.error('Report search error:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchReports(val), 350);
  };

  const handleSelect = (report: ReportResult) => {
    setIsOpen(false);
    setQuery('');
    setResults([]);
    onSelect(report);
  };

  if (!isOpen) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
        title="Chercher un rapport"
      >
        <FolderSearch className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <>
      {/* Invisible trigger button to keep layout slot */}
      <button
        onClick={() => { setIsOpen(false); setQuery(''); setResults([]); }}
        className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full text-primary bg-primary/10 transition-colors"
        title="Fermer la recherche"
      >
        <FolderSearch className="h-3.5 w-3.5" />
      </button>
      {/* Panel positioned relative to the parent border-t container */}
      <div ref={panelRef} className="absolute bottom-full left-0 right-0 mb-1 z-30">
        <div className="mx-2 rounded-xl border border-border/50 bg-background/98 shadow-lg backdrop-blur-md overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
          <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="crawl, SEO, GEO, domaine…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false);
                setQuery('');
              }
            }}
          />
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />}
          <button
            onClick={() => { setIsOpen(false); setQuery(''); setResults([]); }}
            className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-48 overflow-y-auto">
            {results.map((r) => {
              const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.seo;
              const Icon = cfg.icon;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40 transition-colors text-left group"
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', cfg.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-foreground truncate">{r.label}</span>
                      <span className={cn('text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded', cfg.color, 'bg-current/5')}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 truncate">
                      {r.domain} · {format(new Date(r.date), 'dd MMM yyyy', { locale: fr })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {query && !loading && results.length === 0 && (
          <div className="px-3 py-3 text-center text-[11px] text-muted-foreground/50">
            Aucun rapport trouvé
          </div>
        )}

        {!query && (
          <div className="px-3 py-2.5 text-[10px] text-muted-foreground/40 text-center">
            Tapez un mot-clé ou un domaine
          </div>
        )}
        </div>
      </div>
    </>
  );
}
