import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp, TrendingDown, Minus, RefreshCw, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface TrackedKeyword {
  id: string;
  keyword: string;
  source: string;
  search_volume: number | null;
  current_position: number | null;
  previous_position: number | null;
  position_change: number | null;
  last_checked_at: string | null;
}

interface GmbKeywordsTabProps {
  trackedSiteId: string | null;
  businessName: string;
  businessCategory?: string;
  businessCity?: string;
}

const translations = {
  fr: {
    title: 'Mots-clés locaux suivis',
    subtitle: 'Suivez vos positions sur les requêtes locales stratégiques',
    suggest: 'Suggestions IA',
    suggesting: 'Analyse en cours...',
    noKeywords: 'Aucun mot-clé suivi pour le moment.',
    noKeywordsDesc: 'Cliquez sur "Suggestions IA" pour obtenir 5 mots-clés stratégiques basés sur votre fiche GMB.',
    keyword: 'Mot-clé',
    volume: 'Volume',
    position: 'Position',
    trend: 'Tendance',
    source: 'Source',
    delete: 'Retirer',
    notRanked: 'N/R',
    suggestion: 'Suggestion',
    manual: 'Manuel',
  },
  en: {
    title: 'Local Tracked Keywords',
    subtitle: 'Track your positions on strategic local queries',
    suggest: 'AI Suggestions',
    suggesting: 'Analyzing...',
    noKeywords: 'No tracked keywords yet.',
    noKeywordsDesc: 'Click "AI Suggestions" to get 5 strategic keywords based on your GMB listing.',
    keyword: 'Keyword',
    volume: 'Volume',
    position: 'Position',
    trend: 'Trend',
    source: 'Source',
    delete: 'Remove',
    notRanked: 'N/R',
    suggestion: 'Suggestion',
    manual: 'Manual',
  },
  es: {
    title: 'Palabras clave locales rastreadas',
    subtitle: 'Rastrea tus posiciones en consultas locales estratégicas',
    suggest: 'Sugerencias IA',
    suggesting: 'Analizando...',
    noKeywords: 'Aún no hay palabras clave rastreadas.',
    noKeywordsDesc: 'Haz clic en "Sugerencias IA" para obtener 5 palabras clave estratégicas basadas en tu ficha GMB.',
    keyword: 'Palabra clave',
    volume: 'Volumen',
    position: 'Posición',
    trend: 'Tendencia',
    source: 'Fuente',
    delete: 'Eliminar',
    notRanked: 'N/R',
    suggestion: 'Sugerencia',
    manual: 'Manual',
  },
};

export function GmbKeywordsTab({ trackedSiteId, businessName, businessCategory, businessCity }: GmbKeywordsTabProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    fetchKeywords();
  }, [user, trackedSiteId]);

  async function fetchKeywords() {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('gmb_tracked_keywords' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (trackedSiteId) {
        query = query.eq('tracked_site_id', trackedSiteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setKeywords((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching GMB keywords:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSuggest() {
    if (!user) return;
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('serpapi-actions', {
        body: {
          action: 'suggest_gmb_keywords',
          businessName,
          businessCategory: businessCategory || '',
          businessCity: businessCity || '',
          trackedSiteId,
          language,
        },
      });

      if (error) throw error;

      if (data?.keywords?.length) {
        // Insert suggestions into DB
        const inserts = data.keywords.map((kw: any) => ({
          user_id: user.id,
          tracked_site_id: trackedSiteId,
          keyword: kw.keyword,
          source: 'suggestion',
          search_volume: kw.search_volume || null,
          current_position: kw.position || null,
        }));

        const { error: insertError } = await supabase
          .from('gmb_tracked_keywords' as any)
          .insert(inserts);

        if (insertError) throw insertError;

        toast.success(language === 'fr' ? `${data.keywords.length} mots-clés ajoutés` : `${data.keywords.length} keywords added`);
        fetchKeywords();
      } else {
        toast.info(language === 'fr' ? 'Aucune suggestion trouvée' : 'No suggestions found');
      }
    } catch (err) {
      console.error('Error suggesting keywords:', err);
      toast.error(language === 'fr' ? 'Erreur lors de la suggestion' : 'Error suggesting keywords');
    } finally {
      setSuggesting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('gmb_tracked_keywords' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      setKeywords(prev => prev.filter(k => k.id !== id));
    } catch (err) {
      console.error('Error deleting keyword:', err);
    }
  }

  function renderTrend(change: number | null) {
    if (change === null || change === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (change > 0) return (
      <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400 text-xs font-medium">
        <TrendingUp className="h-3.5 w-3.5" /> +{change}
      </span>
    );
    return (
      <span className="flex items-center gap-0.5 text-red-500 text-xs font-medium">
        <TrendingDown className="h-3.5 w-3.5" /> {change}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{t.title}</h3>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSuggest}
          disabled={suggesting}
          className="gap-1.5"
        >
          {suggesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {suggesting ? t.suggesting : t.suggest}
        </Button>
      </div>

      {keywords.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">{t.noKeywords}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.noKeywordsDesc}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">{t.keyword}</th>
                  <th className="text-center py-2 px-3 font-medium">{t.volume}</th>
                  <th className="text-center py-2 px-3 font-medium">{t.position}</th>
                  <th className="text-center py-2 px-3 font-medium">{t.trend}</th>
                  <th className="text-right py-2 px-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw) => (
                  <tr key={kw.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium">{kw.keyword}</td>
                    <td className="py-2.5 px-3 text-center text-muted-foreground">
                      {kw.search_volume != null ? kw.search_volume.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {kw.current_position != null ? (
                        <Badge variant={kw.current_position <= 3 ? 'default' : kw.current_position <= 10 ? 'secondary' : 'outline'} className="text-xs">
                          #{kw.current_position}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">{t.notRanked}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {renderTrend(kw.position_change)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(kw.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
