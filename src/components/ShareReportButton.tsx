import { useState } from 'react';
import { Share2, Copy, Mail, Check, Loader2, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { CrawlResult } from '@/types/crawler';
import { PageSpeedResult } from '@/types/pagespeed';
import { GeoResult } from '@/types/geo';
import { LLMAnalysisResult } from '@/types/llm';

interface ShareReportButtonProps {
  type: 'crawlers' | 'geo' | 'llm' | 'pagespeed';
  url: string;
  crawlResult?: CrawlResult | null;
  pageSpeedResult?: PageSpeedResult | null;
  geoResult?: GeoResult | null;
  llmResult?: LLMAnalysisResult | null;
}

export function ShareReportButton({
  type,
  url,
  crawlResult,
  pageSpeedResult,
  geoResult,
  llmResult,
}: ShareReportButtonProps) {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const hasData = crawlResult || pageSpeedResult || geoResult || llmResult;

  const getReportData = () => {
    switch (type) {
      case 'crawlers':
        return crawlResult;
      case 'geo':
        return geoResult;
      case 'llm':
        return llmResult;
      case 'pagespeed':
        return pageSpeedResult;
    }
  };

  const getScore = () => {
    switch (type) {
      case 'crawlers':
        if (!crawlResult) return '';
        const allowed = crawlResult.bots.filter(b => b.status === 'allowed').length;
        return `${allowed}/${crawlResult.bots.length} bots autorisés`;
      case 'geo':
        return geoResult ? `${geoResult.totalScore}/100` : '';
      case 'llm':
        return llmResult ? `${llmResult.overallScore}/100` : '';
      case 'pagespeed':
        return pageSpeedResult ? `${pageSpeedResult.scores.performance}/100` : '';
    }
  };

  const getEmailContent = () => {
    const score = getScore();
    const reportType = {
      crawlers: language === 'fr' ? 'Bots IA' : language === 'es' ? 'Bots IA' : 'AI Bots',
      geo: 'GEO',
      llm: 'LLM',
      pagespeed: 'PageSpeed',
    }[type];

    const templates = {
      fr: {
        subject: `📊 Rapport d'analyse ${reportType} pour ${new URL(url).hostname}`,
        body: `Bonjour,

Je voulais partager avec vous ce rapport d'analyse ${reportType} que j'ai généré avec Crawlers.fr.

🔗 URL analysée : ${url}
📈 Score obtenu : ${score}

👉 Consultez le rapport complet ici : [LIEN]

Ce rapport vous donne une vue détaillée de ${
          type === 'crawlers' ? "l'accessibilité de votre site aux robots IA (GPTBot, ClaudeBot, etc.)" :
          type === 'geo' ? "l'optimisation de votre site pour les moteurs de recherche génératifs" :
          type === 'llm' ? "la visibilité de votre marque dans les réponses des LLMs" :
          "la performance et les Core Web Vitals de votre site"
        }.

L'outil est gratuit et sans inscription : https://crawlers.fr

Cordialement`,
      },
      en: {
        subject: `📊 ${reportType} Analysis Report for ${new URL(url).hostname}`,
        body: `Hi,

I wanted to share this ${reportType} analysis report I generated with Crawlers.fr.

🔗 Analyzed URL: ${url}
📈 Score: ${score}

👉 View the full report here: [LINK]

This report provides detailed insights into ${
          type === 'crawlers' ? "your site's accessibility to AI crawlers (GPTBot, ClaudeBot, etc.)" :
          type === 'geo' ? "your site's optimization for generative search engines" :
          type === 'llm' ? "your brand's visibility in LLM responses" :
          "your site's performance and Core Web Vitals"
        }.

The tool is free and requires no signup: https://crawlers.fr

Best regards`,
      },
      es: {
        subject: `📊 Informe de análisis ${reportType} para ${new URL(url).hostname}`,
        body: `Hola,

Quería compartir este informe de análisis ${reportType} que generé con Crawlers.fr.

🔗 URL analizada: ${url}
📈 Puntuación: ${score}

👉 Consulta el informe completo aquí: [ENLACE]

Este informe proporciona información detallada sobre ${
          type === 'crawlers' ? "la accesibilidad de tu sitio a los robots de IA (GPTBot, ClaudeBot, etc.)" :
          type === 'geo' ? "la optimización de tu sitio para los motores de búsqueda generativos" :
          type === 'llm' ? "la visibilidad de tu marca en las respuestas de los LLMs" :
          "el rendimiento y los Core Web Vitals de tu sitio"
        }.

La herramienta es gratuita y sin registro: https://crawlers.fr

Saludos`,
      },
    };

    return templates[language as keyof typeof templates] || templates.en;
  };

  const handleGenerateLink = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('share-actions', {
        body: {
          action: 'create',
          type,
          url,
          data: getReportData(),
          language,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setShareUrl(data.shareUrl);
      toast({
        title: language === 'fr' ? 'Lien généré !' : language === 'es' ? '¡Enlace generado!' : 'Link generated!',
        description: language === 'fr' ? 'Valide pendant 7 jours' : language === 'es' ? 'Válido por 7 días' : 'Valid for 7 days',
      });
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({
        title: language === 'fr' ? 'Erreur' : language === 'es' ? 'Error' : 'Error',
        description: language === 'fr' ? 'Impossible de générer le lien' : language === 'es' ? 'No se pudo generar el enlace' : 'Could not generate link',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: language === 'fr' ? 'Copié !' : language === 'es' ? '¡Copiado!' : 'Copied!',
    });
  };

  const handleSendEmail = () => {
    const { subject, body } = getEmailContent();
    const emailBody = body.replace('[LIEN]', shareUrl).replace('[LINK]', shareUrl).replace('[ENLACE]', shareUrl);
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`);
  };

  const getConcreteInsight = () => {
    switch (type) {
      case 'crawlers':
        if (!crawlResult) return '';
        const blocked = crawlResult.bots.filter(b => b.status === 'blocked');
        if (blocked.length > 0) {
          return language === 'fr' 
            ? `${blocked[0].name} est bloqué sur ce site`
            : language === 'es'
            ? `${blocked[0].name} está bloqueado en este sitio`
            : `${blocked[0].name} is blocked on this site`;
        }
        return language === 'fr' ? 'Tous les bots IA sont autorisés' : language === 'es' ? 'Todos los bots IA están autorizados' : 'All AI bots are allowed';
      case 'geo':
        return geoResult 
          ? (language === 'fr' ? `Score GEO de ${geoResult.totalScore}/100` : language === 'es' ? `Puntuación GEO de ${geoResult.totalScore}/100` : `GEO score of ${geoResult.totalScore}/100`)
          : '';
      case 'llm':
        return llmResult 
          ? (language === 'fr' ? `Visibilité LLM de ${llmResult.overallScore}%` : language === 'es' ? `Visibilidad LLM de ${llmResult.overallScore}%` : `LLM visibility of ${llmResult.overallScore}%`)
          : '';
      case 'pagespeed':
        if (!pageSpeedResult) return '';
        const perf = pageSpeedResult.scores.performance;
        return language === 'fr' 
          ? `Performance Lighthouse : ${perf}/100, LCP : ${pageSpeedResult.scores.lcp}`
          : language === 'es'
          ? `Rendimiento Lighthouse: ${perf}/100, LCP: ${pageSpeedResult.scores.lcp}`
          : `Lighthouse performance: ${perf}/100, LCP: ${pageSpeedResult.scores.lcp}`;
    }
  };

  const getLinkedInText = () => {
    const insight = getConcreteInsight();
    const hostname = url ? new URL(url).hostname : '';
    
    const templates = {
      fr: `📊 Audit réalisé pour ${hostname} : ${insight}.\n\nTestez gratuitement votre visibilité IA ➡️ crawlers.fr\n\n#SEO #GEO #IA`,
      en: `📊 Audit completed for ${hostname}: ${insight}.\n\nTest your AI visibility for free ➡️ crawlers.fr\n\n#SEO #GEO #AI`,
      es: `📊 Auditoría para ${hostname}: ${insight}.\n\nPrueba gratis tu visibilidad IA ➡️ crawlers.fr\n\n#SEO #GEO #IA`,
    };
    
    return templates[language as keyof typeof templates] || templates.en;
  };

  const handleShareLinkedIn = () => {
    const text = getLinkedInText();
    // LinkedIn share uses the report URL as the main link
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedInUrl, '_blank', 'width=600,height=600');
    // Copy text to clipboard so user can paste it
    navigator.clipboard.writeText(text);
  };

  if (!hasData) return null;

  const buttonLabel = {
    fr: 'Partager',
    en: 'Share',
    es: 'Compartir',
  }[language] || 'Share';

  const dialogTitle = {
    fr: 'Partager le rapport',
    en: 'Share Report',
    es: 'Compartir informe',
  }[language] || 'Share Report';

  const generateLabel = {
    fr: 'Générer un lien temporaire',
    en: 'Generate temporary link',
    es: 'Generar enlace temporal',
  }[language] || 'Generate temporary link';

  const emailLabel = {
    fr: 'Envoyer par email',
    en: 'Send by email',
    es: 'Enviar por email',
  }[language] || 'Send by email';

  const linkedInLabel = {
    fr: 'Partager sur LinkedIn',
    en: 'Share on LinkedIn',
    es: 'Compartir en LinkedIn',
  }[language] || 'Share on LinkedIn';

  const emailPreviewLabel = {
    fr: 'Aperçu du message',
    en: 'Message preview',
    es: 'Vista previa del mensaje',
  }[language] || 'Message preview';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
        >
          <Share2 className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {language === 'fr' 
              ? 'Générez un lien temporaire (7 jours) vers une version web du rapport.'
              : language === 'es'
              ? 'Genera un enlace temporal (7 días) a una versión web del informe.'
              : 'Generate a temporary link (7 days) to a web version of the report.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!shareUrl ? (
            <Button
              onClick={handleGenerateLink}
              disabled={isLoading}
              className="w-full gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {generateLabel}
            </Button>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === 'fr' ? 'Lien de partage' : language === 'es' ? 'Enlace de compartir' : 'Share link'}
                </label>
                <div className="flex gap-2">
                  <Input 
                    value={`crawlers.fr/temporarylink/${shareUrl.split('/').pop()?.split('?')[0] || ''}`} 
                    readOnly 
                    className="flex-1 text-sm font-mono" 
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleCopyLink}
                    aria-label={language === 'fr' ? 'Copier le lien' : language === 'es' ? 'Copiar enlace' : 'Copy link'}
                  >
                    {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === 'fr' ? 'Lien raccourci valide 7 jours' : language === 'es' ? 'Enlace corto válido 7 días' : 'Short link valid for 7 days'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{emailPreviewLabel}</label>
                <Textarea
                  value={getEmailContent().body.replace('[LIEN]', shareUrl).replace('[LINK]', shareUrl).replace('[ENLACE]', shareUrl)}
                  readOnly
                  className="min-h-[200px] text-sm"
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSendEmail} className="flex-1 gap-2">
                  <Mail className="h-4 w-4" />
                  {emailLabel}
                </Button>
                <Button 
                  onClick={handleShareLinkedIn} 
                  className="flex-1 gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white"
                >
                  <Linkedin className="h-4 w-4" />
                  {linkedInLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
