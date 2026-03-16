import { useState, useEffect } from 'react';
import { Copy, Code2, Trash2, Check, ExternalLink, ThumbsUp, Plug, History, Bug } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, es, enUS } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { MyScriptRulesHistory } from './MyScriptRulesHistory';
import { ScriptDebugTool } from './ScriptDebugTool';

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
  validated_at: string | null;
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
    itWorks: 'Ça marche !',
    validated: 'Validé ✓',
    validatedToast: 'Merci ! Script validé et ajouté à la bibliothèque éprouvée.',
    validateError: 'Erreur lors de la validation',
    tabScripts: 'Scripts',
    tabHistory: 'Historique',
    tabDebug: 'Diagnostic',
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
    itWorks: 'It works!',
    validated: 'Validated ✓',
    validatedToast: 'Thanks! Script validated and added to the proven library.',
    validateError: 'Error validating',
    tabScripts: 'Scripts',
    tabHistory: 'History',
    tabDebug: 'Diagnostic',
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
    itWorks: '¡Funciona!',
    validated: 'Validado ✓',
    validatedToast: '¡Gracias! Script validado y añadido a la biblioteca probada.',
    validateError: 'Error al validar',
    tabScripts: 'Scripts',
    tabHistory: 'Historial',
    tabDebug: 'Diagnóstico',
  },
};

export function MyCorrectiveCodes() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const t = translations[language];
  const [codes, setCodes] = useState<CorrectiveCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [validatedIds, setValidatedIds] = useState<Set<string>>(new Set());
  const [validatingId, setValidatingId] = useState<string | null>(null);

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
        validated_at: (item as any).validated_at || null,
        fixes_applied: (item.fixes_applied as unknown as CorrectiveCodeFix[]) || []
      }));
      setCodes(mappedCodes);
      // Pre-populate validated IDs
      const preValidated = new Set(mappedCodes.filter(c => c.validated_at).map(c => c.id));
      if (preValidated.size > 0) setValidatedIds(preValidated);
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

  const validateCode = async (code: CorrectiveCode) => {
    setValidatingId(code.id);
    try {
      // For each fix in this code, find matching solution_library entries and validate them
      for (const fix of code.fixes_applied) {
        // Find the matching solution in the library
        const { data: existing } = await supabase
          .from('solution_library')
          .select('id, success_rate, usage_count')
          .eq('error_type', fix.id)
          .limit(1)
          .maybeSingle();

        if (existing) {
          // Mark as generic (validated) and increment success_rate
          const newSuccessRate = Math.min(100, (existing.success_rate || 0) + 10);
          await supabase
            .from('solution_library')
            .update({
              is_generic: true,
              success_rate: newSuccessRate,
            })
            .eq('id', existing.id);
        }
      }

      // Mark the corrective code itself as validated (used by prediction engine)
      await supabase
        .from('saved_corrective_codes')
        .update({ validated_at: new Date().toISOString() })
        .eq('id', code.id);

      setValidatedIds(prev => new Set(prev).add(code.id));
      toast.success(t.validatedToast);
    } catch (error) {
      console.error('Error validating code:', error);
      toast.error(t.validateError);
    } finally {
      setValidatingId(null);
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
        <CardContent className="space-y-3 pt-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription>{t.description}</CardDescription>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate('/modifier-code-wordpress')}>
                <Plug className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>WordPress</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="scripts" className="w-full">
          <TabsList className="mb-3 h-8">
            <TabsTrigger value="scripts" className="text-xs gap-1.5 h-7">
              <Code2 className="w-3 h-3" />
              {t.tabScripts}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5 h-7">
              <History className="w-3 h-3" />
              {t.tabHistory}
            </TabsTrigger>
            <TabsTrigger value="debug" className="text-xs gap-1.5 h-7">
              <Bug className="w-3 h-3" />
              {t.tabDebug}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scripts">
            {codes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Code2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">{t.empty}</p>
                <p className="text-sm mt-1">{t.emptyDesc}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {codes.map((code) => {
                  const isValidated = validatedIds.has(code.id);
                  const isValidating = validatingId === code.id;

                  return (
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
                        {isValidated ? (
                          <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                            <Check className="w-3 h-3" /> {t.validated}
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                            onClick={() => validateCode(code)}
                            disabled={isValidating}
                            aria-label={t.itWorks}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{t.itWorks}</span>
                          </Button>
                        )}
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
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <MyScriptRulesHistory />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
