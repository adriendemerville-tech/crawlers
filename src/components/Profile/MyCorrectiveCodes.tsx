import { useState, useEffect } from 'react';
import { Copy, Code2, Trash2, Check, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, es, enUS } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface CorrectiveCodeFix {
  id: string;
  label: string;
  category: string;
}

interface CorrectiveCode {
  id: string;
  title: string;
  url: string;
  code: string;
  fixes_applied: CorrectiveCodeFix[];
  created_at: string;
}

const translations = {
  fr: {
    title: 'Mes Codes Correctifs',
    description: 'Scripts JavaScript générés pour corriger vos sites',
    empty: 'Aucun code correctif sauvegardé',
    emptyDesc: 'Générez un code correctif depuis l\'Audit Expert pour le retrouver ici',
    copied: 'Code copié !',
    deleted: 'Code supprimé',
    deleteError: 'Erreur lors de la suppression',
    fixes: 'correctifs',
  },
  en: {
    title: 'My Corrective Codes',
    description: 'Generated JavaScript scripts to fix your sites',
    empty: 'No corrective codes saved',
    emptyDesc: 'Generate a corrective code from Expert Audit to find it here',
    copied: 'Code copied!',
    deleted: 'Code deleted',
    deleteError: 'Error deleting',
    fixes: 'fixes',
  },
  es: {
    title: 'Mis Códigos Correctivos',
    description: 'Scripts JavaScript generados para corregir sus sitios',
    empty: 'No hay códigos correctivos guardados',
    emptyDesc: 'Genere un código correctivo desde la Auditoría Experta para encontrarlo aquí',
    copied: '¡Código copiado!',
    deleted: 'Código eliminado',
    deleteError: 'Error al eliminar',
    fixes: 'correcciones',
  },
};

export function MyCorrectiveCodes() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const [codes, setCodes] = useState<CorrectiveCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const dateLocale = language === 'fr' ? fr : language === 'es' ? es : enUS;

  useEffect(() => {
    if (user) {
      fetchCodes();
    }
  }, [user]);

  const fetchCodes = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('saved_corrective_codes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching corrective codes:', error);
    } else if (data) {
      const mappedCodes: CorrectiveCode[] = data.map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        code: item.code,
        created_at: item.created_at,
        fixes_applied: (item.fixes_applied as unknown as CorrectiveCodeFix[]) || []
      }));
      setCodes(mappedCodes);
    }
    setLoading(false);
  };

  const copyCode = async (code: CorrectiveCode) => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopiedId(code.id);
      toast.success(t.copied);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const deleteCode = async (id: string) => {
    const { error } = await supabase
      .from('saved_corrective_codes')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(t.deleteError);
    } else {
      toast.success(t.deleted);
      setCodes(codes.filter(c => c.id !== id));
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'seo': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'performance': return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'accessibility': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
      case 'tracking': return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-primary" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {codes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Code2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">{t.empty}</p>
            <p className="text-sm mt-1">{t.emptyDesc}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {codes.map((code) => (
              <div
                key={code.id}
                className="group flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium truncate">{code.title}</h4>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(code.created_at), 'dd MMM yyyy', { locale: dateLocale })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate max-w-[200px]">{code.url}</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {code.fixes_applied.slice(0, 4).map((fix: any, idx: number) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${getCategoryColor(fix.category)}`}
                      >
                        {fix.label}
                      </Badge>
                    ))}
                    {code.fixes_applied.length > 4 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{code.fixes_applied.length - 4}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => deleteCode(code.id)}
                    aria-label="Supprimer le code"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => copyCode(code)}
                    aria-label="Copier le code"
                  >
                    {copiedId === code.id ? (
                      <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
