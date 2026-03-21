import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, FileText, Search, Link2, Code2, Sparkles, Copy, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';

interface ContentAdvisorProps {
  defaultUrl?: string;
  defaultKeyword?: string;
  trackedSiteId?: string;
}

const PAGE_TYPES = [
  { value: 'homepage', label: 'Page d\'accueil' },
  { value: 'product', label: 'Page produit' },
  { value: 'article', label: 'Article / Blog' },
  { value: 'faq', label: 'FAQ' },
  { value: 'landing', label: 'Landing page' },
  { value: 'category', label: 'Catégorie' },
] as const;

export function ContentArchitectureAdvisor({ defaultUrl = '', defaultKeyword = '', trackedSiteId }: ContentAdvisorProps) {
  const [url, setUrl] = useState(defaultUrl);
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [pageType, setPageType] = useState<string>('article');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!url || !keyword || !pageType) {
      toast.error('Remplis l\'URL, le mot-clé et le type de page');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('content-architecture-advisor', {
        body: { url, keyword, page_type: pageType, tracked_site_id: trackedSiteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.data || data);
      toast.success('Recommandations générées');
    } catch (err: any) {
      console.error('Content advisor error:', err);
      toast.error(err.message || 'Erreur lors de l\'analyse');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié !');
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Content Architecture Advisor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="https://example.com/page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-background"
            />
            <Input
              placeholder="Mot-clé cible"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="bg-background"
            />
            <Select value={pageType} onValueChange={setPageType}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Type de page" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_TYPES.map((pt) => (
                  <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAnalyze} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Analyse en cours… (30-60s)
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyser & Recommander
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Coherence Guardrail Banner */}
          {result.coherence_check && (
            <Card className={`border-l-4 ${
              result.coherence_check.warnings?.length > 0 
                ? 'border-l-amber-500 bg-amber-500/5' 
                : 'border-l-emerald-500 bg-emerald-500/5'
            }`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  {result.coherence_check.warnings?.length > 0 ? (
                    <ShieldAlert className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={result.coherence_check.innovation_level === 'conservative' ? 'secondary' : result.coherence_check.innovation_level === 'moderate' ? 'default' : 'destructive'}>
                        Innovation: {result.coherence_check.innovation_level}
                      </Badge>
                      <Badge variant={result.coherence_check.sector_fit === 'high' ? 'secondary' : result.coherence_check.sector_fit === 'medium' ? 'default' : 'destructive'}>
                        Fit secteur: {result.coherence_check.sector_fit}
                      </Badge>
                      <Badge variant={result.coherence_check.tone_continuity === 'aligned' ? 'secondary' : result.coherence_check.tone_continuity === 'slight_shift' ? 'default' : 'destructive'}>
                        Ton: {result.coherence_check.tone_continuity === 'aligned' ? 'cohérent' : result.coherence_check.tone_continuity === 'slight_shift' ? 'léger décalage' : 'rupture'}
                      </Badge>
                      <Badge variant={result.coherence_check.bounce_risk === 'low' ? 'secondary' : result.coherence_check.bounce_risk === 'medium' ? 'default' : 'destructive'}>
                        Risque rebond: {result.coherence_check.bounce_risk === 'low' ? 'faible' : result.coherence_check.bounce_risk === 'medium' ? 'moyen' : 'élevé'}
                      </Badge>
                      <Badge variant="outline" className="ml-auto">
                        Confiance: {result.confidence_score}%
                      </Badge>
                    </div>
                    {result.coherence_check.warnings?.length > 0 && (
                      <div className="space-y-1">
                        {result.coherence_check.warnings.map((w: string, i: number) => (
                          <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        <Tabs defaultValue="structure" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="structure" className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 mr-1" /> Structure
            </TabsTrigger>
            <TabsTrigger value="keywords" className="text-xs sm:text-sm">
              <Search className="h-4 w-4 mr-1" /> Mots-clés
            </TabsTrigger>
            <TabsTrigger value="metadata" className="text-xs sm:text-sm">
              <Code2 className="h-4 w-4 mr-1" /> Métadonnées
            </TabsTrigger>
            <TabsTrigger value="linking" className="text-xs sm:text-sm">
              <Link2 className="h-4 w-4 mr-1" /> Maillage
            </TabsTrigger>
          </TabsList>

          {/* Structure Tab */}
          <TabsContent value="structure">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {result.content_structure && (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">H1 Recommandé</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-primary">{result.content_structure.recommended_h1}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(result.content_structure.recommended_h1)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {result.content_structure.word_count_range && (
                      <div className="grid grid-cols-3 gap-3">
                        {['min', 'ideal', 'max'].map((k) => (
                          <div key={k} className="text-center p-3 rounded-lg bg-muted/50">
                            <p className="text-xs text-muted-foreground capitalize">{k}</p>
                            <p className="text-xl font-bold">{result.content_structure.word_count_range[k]}</p>
                            <p className="text-xs text-muted-foreground">mots</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {result.content_structure.hn_hierarchy?.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">Hiérarchie Hn</h3>
                        <ScrollArea className="max-h-60">
                          <div className="space-y-1">
                            {result.content_structure.hn_hierarchy.map((hn: any, idx: number) => (
                              <div key={idx} className={`flex items-center gap-2 p-2 rounded ${hn.level === 'h2' ? 'bg-primary/5 font-medium' : 'pl-6 text-sm text-muted-foreground'}`}>
                                <Badge variant="outline" className="text-xs shrink-0">{hn.level}</Badge>
                                <span className="truncate">{hn.text}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {result.content_structure.sections?.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">Sections recommandées</h3>
                        <div className="space-y-2">
                          {result.content_structure.sections.map((s: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30">
                              <div>
                                <p className="font-medium text-sm">{s.title}</p>
                                <p className="text-xs text-muted-foreground">{s.purpose}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={s.priority === 'high' ? 'destructive' : s.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                                  {s.priority}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{s.word_count} mots</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {result.keyword_strategy && (
                  <>
                    {result.keyword_strategy.primary_keyword && (
                      <div className="p-3 rounded-lg border border-primary/30 bg-primary/5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold">{result.keyword_strategy.primary_keyword.keyword}</span>
                          <Badge className="bg-primary text-primary-foreground">
                            Densité cible: {result.keyword_strategy.primary_keyword.target_density_percent}%
                          </Badge>
                        </div>
                      </div>
                    )}

                    {result.keyword_strategy.secondary_keywords?.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">Mots-clés secondaires</h3>
                        <div className="flex flex-wrap gap-2">
                          {result.keyword_strategy.secondary_keywords.map((kw: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {kw.keyword} ({kw.target_density_percent}%)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.keyword_strategy.lsi_terms?.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">Termes LSI</h3>
                        <div className="flex flex-wrap gap-2">
                          {result.keyword_strategy.lsi_terms.map((t: any, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {t.term}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.keyword_strategy.semantic_ratio && (
                      <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                        <h3 className="text-sm font-semibold">Ratio Sémantique</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{result.keyword_strategy.semantic_ratio.technical_jargon_percent}%</p>
                            <p className="text-xs text-muted-foreground">Jargon technique</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-500">{result.keyword_strategy.semantic_ratio.accessible_language_percent}%</p>
                            <p className="text-xs text-muted-foreground">Langage accessible</p>
                          </div>
                        </div>
                        {result.keyword_strategy.semantic_ratio.explanation && (
                          <p className="text-xs text-muted-foreground italic">{result.keyword_strategy.semantic_ratio.explanation}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {result.metadata_enrichment && (
                  <>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-muted-foreground">Meta Title</h3>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(result.metadata_enrichment.meta_title)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="p-2 rounded bg-muted/50 text-sm font-mono">{result.metadata_enrichment.meta_title}</p>
                        <p className="text-xs text-muted-foreground">{result.metadata_enrichment.meta_title?.length || 0}/60 caractères</p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-muted-foreground">Meta Description</h3>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(result.metadata_enrichment.meta_description)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="p-2 rounded bg-muted/50 text-sm font-mono">{result.metadata_enrichment.meta_description}</p>
                        <p className="text-xs text-muted-foreground">{result.metadata_enrichment.meta_description?.length || 0}/155 caractères</p>
                      </div>
                    </div>

                    {result.metadata_enrichment.json_ld_schemas?.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">Schemas JSON-LD recommandés</h3>
                        {result.metadata_enrichment.json_ld_schemas.map((schema: any, idx: number) => (
                          <div key={idx} className="relative">
                            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-t">
                              <Badge variant={schema.priority === 'high' ? 'destructive' : 'default'} className="text-xs">
                                {schema.type}
                              </Badge>
                              <Button variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => copyToClipboard(JSON.stringify({ "@context": "https://schema.org", "@type": schema.type, ...schema.properties }, null, 2))}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <pre className="p-3 bg-muted/10 rounded-b text-xs overflow-auto max-h-40 font-mono">
                              {JSON.stringify({ "@context": "https://schema.org", "@type": schema.type, ...schema.properties }, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}

                    {result.metadata_enrichment.structured_data_notes && (
                      <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                        {result.metadata_enrichment.structured_data_notes}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Linking Tab */}
          <TabsContent value="linking">
            <Card>
              <CardContent className="pt-6 space-y-4">
                {result.internal_linking && (
                  <>
                    <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-3xl font-bold text-primary">{result.internal_linking.recommended_internal_links}</p>
                      <p className="text-sm text-muted-foreground">Liens internes recommandés</p>
                    </div>

                    {result.internal_linking.anchor_strategy?.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">Stratégie d'ancres</h3>
                        <div className="space-y-1">
                          {result.internal_linking.anchor_strategy.map((a: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center p-2 rounded bg-muted/30">
                              <span className="font-mono text-sm text-primary">{a.anchor_text}</span>
                              <span className="text-xs text-muted-foreground">{a.target_intent}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.internal_linking.cluster_opportunities?.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">Opportunités de clusters</h3>
                        <div className="flex flex-wrap gap-2">
                          {result.internal_linking.cluster_opportunities.map((c: string, idx: number) => (
                            <Badge key={idx} variant="outline">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bottom: Confidence + Rationale + Sources */}
          <Card className="border-muted">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Score de confiance :</span>
                  <Badge variant={result.confidence_score >= 70 ? 'default' : result.confidence_score >= 40 ? 'secondary' : 'destructive'}>
                    {result.confidence_score}/100
                  </Badge>
                </div>
                {result._meta && (
                  <div className="flex flex-wrap gap-1">
                    {result._meta.sources_used?.site_identity && <Badge variant="outline" className="text-xs">Identité</Badge>}
                    {result._meta.sources_used?.dataforseo_keywords && <Badge variant="outline" className="text-xs">Keywords</Badge>}
                    {result._meta.sources_used?.dataforseo_serp && <Badge variant="outline" className="text-xs">SERP</Badge>}
                    {result._meta.sources_used?.competitor_scraping > 0 && <Badge variant="outline" className="text-xs">{result._meta.sources_used.competitor_scraping} concurrents</Badge>}
                    {result._meta.sources_used?.existing_audit && <Badge variant="outline" className="text-xs">Audit</Badge>}
                    {result._meta.sources_used?.cocoon_data && <Badge variant="outline" className="text-xs">Cocoon</Badge>}
                  </div>
                )}
              </div>
              {result.rationale && (
                <p className="text-sm text-muted-foreground">{result.rationale}</p>
              )}
              {result._meta?.duration_ms && (
                <p className="text-xs text-muted-foreground/60">Généré en {(result._meta.duration_ms / 1000).toFixed(1)}s</p>
              )}
            </CardContent>
          </Card>
        </Tabs>
      )}
    </div>
  );
}
