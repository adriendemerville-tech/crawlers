import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Loader2, Sparkles, Link2, FileText, Globe, Search, Image, 
  Target, Users, Languages, Gauge, Swords, PenTool, Copy, Check,
  ShieldCheck, ShieldAlert, AlertTriangle
} from 'lucide-react';

const PAGE_TYPES = [
  { value: 'homepage', label: 'Page d\'accueil' },
  { value: 'product', label: 'Page produit' },
  { value: 'article', label: 'Article / Blog' },
  { value: 'faq', label: 'FAQ' },
  { value: 'landing', label: 'Landing page' },
  { value: 'category', label: 'Catégorie' },
  { value: 'service', label: 'Page service' },
  { value: 'about', label: 'À propos / Équipe' },
] as const;

const LENGTH_OPTIONS = [
  { value: 'short', label: 'Court (~500 mots)' },
  { value: 'medium', label: 'Moyen (~1200 mots)' },
  { value: 'long', label: 'Long (~2500+ mots)' },
] as const;

const PERSONA_OPTIONS = [
  { value: 'b2b_decision', label: 'B2B Décideur' },
  { value: 'b2c_general', label: 'B2C Grand public' },
  { value: 'b2c_premium', label: 'B2C Premium' },
  { value: 'expert_tech', label: 'Expert technique' },
  { value: 'student', label: 'Étudiant / Apprenant' },
  { value: 'local', label: 'Audience locale' },
] as const;

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'auto', label: '🤖 Auto-détection' },
] as const;

interface ScribeTabProps {
  defaultUrl?: string;
  trackedSiteId?: string | null;
}

export function ScribeTab({ defaultUrl = '', trackedSiteId }: ScribeTabProps) {
  // Form state
  const [prompt, setPrompt] = useState('');
  const [url, setUrl] = useState(defaultUrl);
  const [pageType, setPageType] = useState('article');
  const [length, setLength] = useState('medium');
  const [photoUrl, setPhotoUrl] = useState('');
  const [ctaLink, setCtaLink] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tone, setTone] = useState('auto');
  const [language, setLanguage] = useState('auto');
  const [persona, setPersona] = useState('b2c_general');
  const [jargonLevel, setJargonLevel] = useState([4]);
  const [competitors, setCompetitors] = useState('');
  const [enableCocoonLinks, setEnableCocoonLinks] = useState(true);

  // Results
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!url || !keyword) {
      toast.error('L\'URL et le mot-clé cible sont requis');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('content-architecture-advisor', {
        body: {
          url,
          keyword,
          page_type: pageType,
          tracked_site_id: trackedSiteId || undefined,
          // Extended Scribe fields
          scribe_mode: true,
          prompt: prompt || undefined,
          target_length: length,
          photo_url: photoUrl || undefined,
          cta_link: ctaLink || undefined,
          tone_override: tone !== 'auto' ? tone : undefined,
          language: language !== 'auto' ? language : undefined,
          persona,
          jargon_level: jargonLevel[0],
          competitor_urls: competitors ? competitors.split('\n').map(u => u.trim()).filter(Boolean) : undefined,
          enable_cocoon_links: enableCocoonLinks,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data?.data || data);
      toast.success('Recommandations Scribe générées');
    } catch (err: any) {
      console.error('Scribe error:', err);
      toast.error(err.message || 'Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
          β BETA
        </Badge>
        <span className="text-xs text-muted-foreground">
          Scribe génère une architecture de contenu optimisée SEO/GEO via Content Architecture Advisor
        </span>
      </div>

      {/* Form Grid */}
      <div className="space-y-3">
        {/* Row 1: Prompt */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            <PenTool className="w-3 h-3 inline mr-1" />
            Instructions (prompt)
          </label>
          <Textarea
            placeholder="Ex: Rédige un article expert sur les Core Web Vitals 2026, orienté conversion pour une agence SEO..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-background text-sm min-h-[60px]"
          />
        </div>

        {/* Row 2: URL + Keyword */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <Globe className="w-3 h-3 inline mr-1" />
              URL cible
            </label>
            <Input
              placeholder="https://example.com/page"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <Search className="w-3 h-3 inline mr-1" />
              Mot-clé cible (DataForSEO)
            </label>
            <Input
              placeholder="core web vitals optimisation"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="bg-background text-sm"
            />
          </div>
        </div>

        {/* Row 3: Page type + Length + Language */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <FileText className="w-3 h-3 inline mr-1" />
              Type de page
            </label>
            <Select value={pageType} onValueChange={setPageType}>
              <SelectTrigger className="bg-background text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_TYPES.map(pt => (
                  <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <Gauge className="w-3 h-3 inline mr-1" />
              Longueur
            </label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger className="bg-background text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LENGTH_OPTIONS.map(lo => (
                  <SelectItem key={lo.value} value={lo.value}>{lo.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <Languages className="w-3 h-3 inline mr-1" />
              Langue
            </label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="bg-background text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map(lo => (
                  <SelectItem key={lo.value} value={lo.value}>{lo.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 4: Persona + Tone */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <Users className="w-3 h-3 inline mr-1" />
              Persona / Cible
            </label>
            <Select value={persona} onValueChange={setPersona}>
              <SelectTrigger className="bg-background text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERSONA_OPTIONS.map(po => (
                  <SelectItem key={po.value} value={po.value}>{po.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <Target className="w-3 h-3 inline mr-1" />
              Ton éditorial
            </label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="bg-background text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">🤖 Auto (carte d'identité)</SelectItem>
                <SelectItem value="professional">Professionnel</SelectItem>
                <SelectItem value="conversational">Conversationnel</SelectItem>
                <SelectItem value="expert">Expert / Technique</SelectItem>
                <SelectItem value="institutional">Institutionnel</SelectItem>
                <SelectItem value="friendly">Chaleureux / Humain</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 5: Photo + CTA */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <Image className="w-3 h-3 inline mr-1" />
              Photo / Média (URL)
            </label>
            <Input
              placeholder="https://example.com/image.jpg"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              <Link2 className="w-3 h-3 inline mr-1" />
              Lien CTA cible
            </label>
            <Input
              placeholder="https://example.com/contact"
              value={ctaLink}
              onChange={(e) => setCtaLink(e.target.value)}
              className="bg-background text-sm"
            />
          </div>
        </div>

        {/* Row 6: Jargon Slider + Cocoon toggle */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Niveau de jargon : <span className="text-foreground font-bold">{jargonLevel[0]}/10</span>
            </label>
            <Slider
              value={jargonLevel}
              onValueChange={setJargonLevel}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Grand public</span>
              <span>Expert</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              checked={enableCocoonLinks}
              onChange={(e) => setEnableCocoonLinks(e.target.checked)}
              className="rounded border-muted-foreground"
            />
            <label className="text-xs text-muted-foreground">
              🕸️ Maillage interne auto (Cocoon)
            </label>
          </div>
        </div>

        {/* Row 7: Competitors */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            <Swords className="w-3 h-3 inline mr-1" />
            URLs concurrentes (1-3, une par ligne)
          </label>
          <Textarea
            placeholder={"https://concurrent1.com/article\nhttps://concurrent2.com/article"}
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            className="bg-background text-sm min-h-[50px]"
            rows={2}
          />
        </div>
      </div>

      <Separator />

      {/* Generate Button */}
      <Button 
        onClick={handleGenerate} 
        disabled={loading || !url || !keyword}
        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Génération Scribe en cours…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Lancer Scribe
          </>
        )}
      </Button>

      {/* Results */}
      {result && (
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4">
            {/* Coherence guardrail banner */}
            {result.coherence_check && (
              <Card className={`border ${
                result.coherence_check.innovation_level === 'disruptive' 
                  ? 'border-amber-500/50 bg-amber-500/5' 
                  : 'border-emerald-500/50 bg-emerald-500/5'
              }`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {result.coherence_check.innovation_level === 'disruptive' ? (
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    )}
                    <span className="text-xs font-medium">Garde-fous cohérence</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      Innovation: {result.coherence_check.innovation_level}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Fit secteur: {result.coherence_check.sector_fit}%
                    </Badge>
                    {result.coherence_check.tone_continuity && (
                      <Badge variant="outline" className="text-[10px]">
                        Ton: {result.coherence_check.tone_continuity}%
                      </Badge>
                    )}
                  </div>
                  {result.guardrail_warnings?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {result.guardrail_warnings.map((w: string, i: number) => (
                        <div key={i} className="flex items-start gap-1 text-[10px] text-amber-600">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recommended structure */}
            {result.recommended_structure && (
              <Card className="border-primary/20">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Structure recommandée</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(result.recommended_structure, null, 2))}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap overflow-hidden font-mono bg-muted/50 p-2 rounded">
                    {JSON.stringify(result.recommended_structure, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Schema.org / Metadata */}
            {result.recommended_metadata && (
              <Card className="border-primary/20">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Métadonnées & Schema.org</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(result.recommended_metadata, null, 2))}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap overflow-hidden font-mono bg-muted/50 p-2 rounded">
                    {JSON.stringify(result.recommended_metadata, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Keywords */}
            {result.keyword_analysis && (
              <Card className="border-primary/20">
                <CardContent className="p-3">
                  <span className="text-sm font-medium block mb-2">Analyse mots-clés</span>
                  <div className="flex flex-wrap gap-1">
                    {(result.keyword_analysis.primary_keywords || []).map((kw: any, i: number) => (
                      <Badge key={i} className="text-[10px] bg-primary/10 text-primary">
                        {typeof kw === 'string' ? kw : kw.keyword} 
                        {kw.volume && <span className="ml-1 opacity-60">({kw.volume})</span>}
                      </Badge>
                    ))}
                    {(result.keyword_analysis.secondary_keywords || []).map((kw: any, i: number) => (
                      <Badge key={`s-${i}`} variant="outline" className="text-[10px]">
                        {typeof kw === 'string' ? kw : kw.keyword}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Internal links (Cocoon) */}
            {result.internal_links && result.internal_links.length > 0 && (
              <Card className="border-primary/20">
                <CardContent className="p-3">
                  <span className="text-sm font-medium block mb-2">🕸️ Maillage interne suggéré</span>
                  <div className="space-y-1">
                    {result.internal_links.map((link: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-primary truncate">{link.anchor || link.url}</span>
                        <span className="text-muted-foreground text-[10px]">→ {link.url}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
