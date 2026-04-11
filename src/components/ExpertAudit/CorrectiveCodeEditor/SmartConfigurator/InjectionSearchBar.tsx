import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Lock, ChevronDown, Zap, FileText, Code, Globe, Settings, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

export interface CatalogEntry {
  id: string;
  slug: string;
  category: string;
  label: string;
  description: string;
  template_code: string | null;
  required_data: Record<string, any>;
  seo_impact: string;
  is_premium: boolean;
  display_order: number;
}

const categoryMeta: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  schema_jsonld: { icon: Code, label: 'Schema JSON-LD', color: 'text-violet-500' },
  meta_html: { icon: FileText, label: 'Meta HTML', color: 'text-blue-500' },
  root_files: { icon: Globe, label: 'Fichiers Racine', color: 'text-emerald-500' },
  html_css_inline: { icon: Sparkles, label: 'HTML/CSS Inline', color: 'text-amber-500' },
  technical_attributes: { icon: Settings, label: 'Attributs Techniques', color: 'text-rose-500' },
};

const impactColors: Record<string, string> = {
  high: 'bg-red-500/10 text-red-600 border-red-500/30',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  low: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
};

interface InjectionSearchBarProps {
  isSubscriber: boolean;
  onSelectInjection: (entry: CatalogEntry) => void;
  selectedSlug?: string | null;
}

export function InjectionSearchBar({ isSubscriber, onSelectInjection, selectedSlug }: InjectionSearchBarProps) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState<string[]>(['schema_jsonld']);

  useEffect(() => {
    const fetchCatalog = async () => {
      const { data } = await supabase
        .from('injection_catalog')
        .select('*')
        .order('display_order', { ascending: true });
      if (data) setCatalog(data as unknown as CatalogEntry[]);
      setLoading(false);
    };
    fetchCatalog();
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return catalog;
    const q = searchQuery.toLowerCase();
    return catalog.filter(e =>
      e.label.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.slug.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    );
  }, [catalog, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, CatalogEntry[]> = {};
    for (const entry of filtered) {
      if (!groups[entry.category]) groups[entry.category] = [];
      groups[entry.category].push(entry);
    }
    return groups;
  }, [filtered]);

  const toggleCategory = (cat: string) => {
    setOpenCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Chargement du catalogue…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with lock indicator */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un type d'injection…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
            disabled={!isSubscriber}
          />
        </div>
        {!isSubscriber && (
          <Badge variant="outline" className="text-xs gap-1 border-muted-foreground/30 text-muted-foreground whitespace-nowrap">
            <Lock className="w-3 h-3" />
            Pro
          </Badge>
        )}
      </div>

      {!isSubscriber && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5 border border-dashed border-muted-foreground/20">
          <Lock className="w-3 h-3 inline mr-1" />
          Le mode avancé est réservé aux abonnés. Passez à Pro pour accéder au catalogue complet d'injections.
        </div>
      )}

      {/* Catalog browsing */}
      <ScrollArea className={`${isSubscriber ? 'max-h-[400px]' : 'max-h-[200px] opacity-50 pointer-events-none'}`}>
        <div className="space-y-2">
          {Object.entries(grouped).map(([category, entries]) => {
            const meta = categoryMeta[category] || { icon: Code, label: category, color: 'text-muted-foreground' };
            const Icon = meta.icon;
            const isOpen = openCategories.includes(category);

            return (
              <Collapsible key={category} open={isOpen} onOpenChange={() => toggleCategory(category)}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                      <span className="text-sm font-medium">{meta.label}</span>
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">{entries.length}</Badge>
                    </div>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="ml-6 space-y-1 pt-1">
                    <AnimatePresence>
                      {entries.map(entry => (
                        <motion.button
                          key={entry.slug}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          onClick={() => onSelectInjection(entry)}
                          className={`w-full text-left flex items-start gap-2 p-2 rounded-lg border transition-all ${
                            selectedSlug === entry.slug
                              ? 'bg-primary/10 border-primary/40'
                              : 'bg-transparent border-transparent hover:bg-muted/50 hover:border-muted-foreground/20'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium">{entry.label}</span>
                              {entry.is_premium && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/50 text-amber-500">
                                  Premium
                                </Badge>
                              )}
                              <Badge variant="outline" className={`text-[10px] px-1 py-0 ${impactColors[entry.seo_impact] || ''}`}>
                                {entry.seo_impact === 'high' ? '↑↑↑' : entry.seo_impact === 'medium' ? '↑↑' : '↑'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{entry.description}</p>
                          </div>
                        </motion.button>
                      ))}
                    </AnimatePresence>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          {Object.keys(grouped).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun résultat pour « {searchQuery} »</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
