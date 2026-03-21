import { useState, useEffect } from 'react';
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
  ShieldCheck, ShieldAlert, AlertTriangle, Wand2
} from 'lucide-react';
import { ScribeResultsPanel } from './ScribeResultsPanel';

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

// --- Helpers to map identity card data to form values ---

function mapTargetAudienceToPersona(target?: string | null, businessType?: string | null): string {
  if (!target) {
    if (businessType === 'B2B') return 'b2b_decision';
    return 'b2c_general';
  }
  const t = target.toLowerCase();
  if (t.includes('b2b') || t.includes('décideur') || t.includes('entreprise') || t.includes('professionnel'))
    return 'b2b_decision';
  if (t.includes('premium') || t.includes('luxe') || t.includes('haut de gamme'))
    return 'b2c_premium';
  if (t.includes('expert') || t.includes('technique') || t.includes('développeur') || t.includes('ingénieur'))
    return 'expert_tech';
  if (t.includes('étudiant') || t.includes('formation') || t.includes('apprenant'))
    return 'student';
  if (t.includes('local') || t.includes('proximité') || t.includes('quartier'))
    return 'local';
  return 'b2c_general';
}

function mapEntityTypeToTone(entityType?: string | null, nonprofitType?: string | null): string {
  if (nonprofitType) {
    if (['service_public', 'ong', 'organisation_internationale'].includes(nonprofitType))
      return 'institutional';
    if (['association_locale', 'federation_sportive'].includes(nonprofitType))
      return 'friendly';
    return 'professional';
  }
  if (!entityType) return 'auto';
  const e = entityType.toLowerCase();
  if (e.includes('public') || e.includes('government') || e.includes('institution')) return 'institutional';
  if (e.includes('startup') || e.includes('saas')) return 'conversational';
  return 'auto';
}

function extractJargonLevel(jargonDistance?: any): number {
  if (!jargonDistance) return 4;
  if (typeof jargonDistance === 'number') return Math.min(10, Math.max(1, Math.round(jargonDistance)));
  if (typeof jargonDistance === 'object' && jargonDistance.score != null)
    return Math.min(10, Math.max(1, Math.round(jargonDistance.score)));
  return 4;
}

function extractCompetitorUrls(competitors?: any, mainSerpCompetitor?: string | null): string {
  const urls: string[] = [];
  if (mainSerpCompetitor) urls.push(mainSerpCompetitor);
  if (Array.isArray(competitors)) {
    competitors.slice(0, 3).forEach((c: any) => {
      const u = typeof c === 'string' ? c : c?.url || c?.domain;
      if (u && !urls.includes(u)) urls.push(u);
    });
  } else if (competitors && typeof competitors === 'object') {
    Object.values(competitors).slice(0, 3).forEach((c: any) => {
      const u = typeof c === 'string' ? c : c?.url || c?.domain;
      if (u && !urls.includes(u)) urls.push(u);
    });
  }
  return urls.slice(0, 3).join('\n');
}

function mapLanguage(lang?: string | null): string {
  if (!lang) return 'auto';
  const l = lang.toLowerCase();
  if (l.startsWith('fr')) return 'fr';
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('es')) return 'es';
  return 'auto';
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

  // Auto-fill state
  const [autoFilled, setAutoFilled] = useState(false);
  const [siteData, setSiteData] = useState<any>(null);

  // Results
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Auto-fill from tracked site identity card
  useEffect(() => {
    if (!trackedSiteId || autoFilled) return;
    
    const fetchAndFill = async () => {
      try {
        const { data: site } = await supabase
          .from('tracked_sites')
          .select('domain, market_sector, target_audience, business_type, primary_language, competitors, entity_type, nonprofit_type, commercial_model, jargon_distance, client_targets, brand_name, main_serp_competitor, products_services')
          .eq('id', trackedSiteId)
          .maybeSingle();

        if (!site) return;
        setSiteData(site);

        // Language
        setLanguage(mapLanguage(site.primary_language));

        // Persona from target_audience + business_type
        setPersona(mapTargetAudienceToPersona(site.target_audience, site.business_type));

        // Tone from entity_type + nonprofit_type
        setTone(mapEntityTypeToTone(site.entity_type, site.nonprofit_type));

        // Jargon level
        setJargonLevel([extractJargonLevel(site.jargon_distance)]);

        // Competitors
        const compUrls = extractCompetitorUrls(site.competitors, site.main_serp_competitor);
        if (compUrls) setCompetitors(compUrls);

        // Auto-generate a smart prompt from identity
        const parts: string[] = [];
        if (site.brand_name) parts.push(`Marque : ${site.brand_name}`);
        if (site.market_sector) parts.push(`Secteur : ${site.market_sector}`);
        if (site.products_services) parts.push(`Offre : ${site.products_services}`);
        if (site.target_audience) parts.push(`Cible : ${site.target_audience}`);
        if (parts.length > 0) {
          setPrompt(`Contexte : ${parts.join(' | ')}. Génère un contenu optimisé pour ce profil.`);
        }

        // Suggest CTA link from domain
        if (site.commercial_model === 'marchand' || site.business_type === 'B2C' || site.business_type === 'B2B') {
          setCtaLink(`https://${site.domain}/contact`);
        }

        // Try to fetch a top keyword from recent audits/SERP data
        const { data: serpData } = await supabase
          .from('domain_data_cache')
          .select('result_data')
          .eq('domain', site.domain)
          .eq('data_type', 'serp_keywords')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (serpData?.result_data) {
          const kws = serpData.result_data as any;
          const topKw = Array.isArray(kws) ? kws[0] : kws?.items?.[0] || kws?.keywords?.[0];
          if (topKw) {
            const kwText = typeof topKw === 'string' ? topKw : topKw?.keyword || topKw?.query;
            if (kwText) setKeyword(kwText);
          }
        }

        setAutoFilled(true);
        toast.success('Champs pré-remplis depuis la carte d\'identité du site');
      } catch (err) {
        console.error('Auto-fill error:', err);
      }
    };

    fetchAndFill();
  }, [trackedSiteId, autoFilled]);

  // Update URL if defaultUrl changes
  useEffect(() => {
    if (defaultUrl) setUrl(defaultUrl);
  }, [defaultUrl]);

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
        {autoFilled && (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs ml-auto">
            <Wand2 className="w-3 h-3 mr-1" />
            Auto-rempli
          </Badge>
        )}
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
      {result && <ScribeResultsPanel result={result} />}
    </div>
  );
}
