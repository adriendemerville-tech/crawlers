import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search, Star, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackedSite {
  id: string;
  domain: string;
  site_name: string | null;
}

interface CocoonSiteSelectorProps {
  userId: string;
  trackedSites: TrackedSite[];
  selectedSiteId: string;
  onSelect: (siteId: string) => void;
  onSiteCreated?: (site: TrackedSite) => void;
  placeholder?: string;
}

export function CocoonSiteSelector({
  userId,
  trackedSites,
  selectedSiteId,
  onSelect,
  onSiteCreated,
  placeholder = "Sélectionner un site",
}: CocoonSiteSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [topSiteIds, setTopSiteIds] = useState<string[]>([]);
  const [allCrawlDomains, setAllCrawlDomains] = useState<{ domain: string; id: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch top 5 most-used cocoon sites
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("cocoon_sessions")
      .select("tracked_site_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!data) return;
        // Count frequency
        const counts: Record<string, number> = {};
        data.forEach((r: any) => {
          counts[r.tracked_site_id] = (counts[r.tracked_site_id] || 0) + 1;
        });
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id]) => id);
        setTopSiteIds(sorted);
      });
  }, [userId]);

  // Fetch all user crawls for search
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("site_crawls")
      .select("id, domain")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        // Deduplicate by domain
        const seen = new Set<string>();
        const unique: { domain: string; id: string }[] = [];
        data.forEach((c: any) => {
          const d = c.domain?.replace(/^www\./, "").toLowerCase();
          if (d && !seen.has(d)) {
            seen.add(d);
            unique.push({ domain: c.domain, id: c.id });
          }
        });
        setAllCrawlDomains(unique);
      });
  }, [userId]);

  // Top sites resolved
  const topSites = useMemo(() => {
    if (!topSiteIds.length) return trackedSites.slice(0, 5);
    const result: TrackedSite[] = [];
    for (const id of topSiteIds) {
      const site = trackedSites.find((s) => s.id === id);
      if (site) result.push(site);
    }
    // Fill remaining slots with other tracked sites
    if (result.length < 5) {
      for (const s of trackedSites) {
        if (!result.find((r) => r.id === s.id)) result.push(s);
        if (result.length >= 5) break;
      }
    }
    return result;
  }, [topSiteIds, trackedSites]);

  // Search results: merge tracked sites + crawl domains not yet tracked
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const results: { id: string; domain: string; label: string; isTracked: boolean }[] = [];
    const seen = new Set<string>();

    // First: tracked sites matching
    for (const s of trackedSites) {
      const d = (s.site_name || s.domain || "").toLowerCase();
      if (d.includes(q)) {
        results.push({ id: s.id, domain: s.domain, label: s.site_name || s.domain, isTracked: true });
        seen.add(s.domain?.replace(/^www\./, "").toLowerCase());
      }
    }

    // Then: crawl domains not in tracked
    for (const c of allCrawlDomains) {
      const d = c.domain?.replace(/^www\./, "").toLowerCase();
      if (d.includes(q) && !seen.has(d)) {
        results.push({ id: c.id, domain: c.domain, label: c.domain, isTracked: false });
        seen.add(d);
      }
    }

    return results.slice(0, 10);
  }, [search, trackedSites, allCrawlDomains]);

  const selectedLabel = useMemo(() => {
    const site = trackedSites.find((s) => s.id === selectedSiteId);
    return site ? (site.site_name || site.domain)?.replace(/^www\./, "") : placeholder;
  }, [selectedSiteId, trackedSites, placeholder]);

  const handleSelectTracked = (siteId: string) => {
    onSelect(siteId);
    setOpen(false);
    setSearch("");
  };

  const handleSelectCrawlDomain = async (domain: string) => {
    // Check if already tracked
    const normalize = (d: string) => d.replace(/^www\./, "").toLowerCase();
    const existing = trackedSites.find((s) => normalize(s.domain) === normalize(domain));
    if (existing) {
      handleSelectTracked(existing.id);
      return;
    }
    // Auto-create tracked site
    const { data: newSite } = await supabase
      .from("tracked_sites")
      .insert({ user_id: userId, domain })
      .select("id")
      .single();
    if (newSite) {
      handleSelectTracked(newSite.id);
      // Parent will reload tracked sites via its own effect
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full sm:w-[260px] justify-between bg-white/5 border-[hsl(263,70%,20%)] text-white text-xs h-8 hover:bg-white/10"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0 bg-[#1a1035] border-[hsl(263,70%,20%)]"
        align="center"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        {/* Search bar */}
        <div className="p-2 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un domaine…"
              className="h-7 pl-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-violet-500/30"
            />
          </div>
        </div>

        <div className="max-h-[240px] overflow-y-auto">
          {/* Search results */}
          {search.trim() ? (
            searchResults.length > 0 ? (
              <div className="p-1">
                {searchResults.map((r) => (
                  <button
                    key={r.id + r.domain}
                    type="button"
                    onClick={() =>
                      r.isTracked
                        ? handleSelectTracked(r.id)
                        : handleSelectCrawlDomain(r.domain)
                    }
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors hover:bg-white/10",
                      r.isTracked && r.id === selectedSiteId && "bg-violet-500/20 text-violet-300"
                    )}
                  >
                    <Globe className="h-3 w-3 text-white/40 shrink-0" />
                    <span className="truncate text-white/80">{r.label?.replace(/^www\./, "")}</span>
                    {!r.isTracked && (
                      <span className="ml-auto text-[9px] text-white/30 shrink-0">crawl</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-white/30">Aucun résultat</div>
            )
          ) : (
            /* Top 5 favorites */
            <div className="p-1">
              {topSites.length > 0 && (
                <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-white/20 font-semibold">
                  Fréquents
                </div>
              )}
              {topSites.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => handleSelectTracked(site.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors hover:bg-white/10",
                    site.id === selectedSiteId && "bg-violet-500/20 text-violet-300"
                  )}
                >
                  <Star className="h-3 w-3 text-amber-500/60 shrink-0" />
                  <span className="truncate text-white/80">
                    {(site.site_name || site.domain)?.replace(/^www\./, "")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
