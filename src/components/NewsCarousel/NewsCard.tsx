import { memo, useCallback } from 'react';
import { Calendar, ExternalLink, Share2 } from 'lucide-react';
import { NewsArticle } from '@/types/news';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface NewsCardProps {
  article: NewsArticle;
  index: number;
}

const categoryColors: Record<string, string> = {
  SEO: 'bg-emerald-500 hover:bg-emerald-600',
  LLM: 'bg-violet-500 hover:bg-violet-600',
  GEO: 'bg-amber-500 hover:bg-amber-600',
};

function NewsCardComponent({ article, index }: NewsCardProps) {
  const { language } = useLanguage();
  const { toast } = useToast();

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [language]);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    const emailTemplates = {
      fr: {
        subject: `📰 Article intéressant : ${article.title}`,
        body: `Bonjour,

Je voulais partager avec vous cet article sur le thème ${article.category} :

📰 ${article.title}

${article.summary}

🔗 Source : ${article.source.name}
📅 Publié le : ${formatDate(article.publishedAt)}

---
Découvert via Crawlers.fr - L'outil gratuit pour analyser votre visibilité IA.

Cordialement`,
      },
      en: {
        subject: `📰 Interesting article: ${article.title}`,
        body: `Hi,

I wanted to share this ${article.category} article with you:

📰 ${article.title}

${article.summary}

🔗 Source: ${article.source.name}
📅 Published: ${formatDate(article.publishedAt)}

---
Discovered via Crawlers.fr - The free tool to analyze your AI visibility.

Best regards`,
      },
      es: {
        subject: `📰 Artículo interesante: ${article.title}`,
        body: `Hola,

Quería compartir este artículo sobre ${article.category}:

📰 ${article.title}

${article.summary}

🔗 Fuente: ${article.source.name}
📅 Publicado el: ${formatDate(article.publishedAt)}

---
Descubierto a través de Crawlers.fr - La herramienta gratuita para analizar tu visibilidad IA.

Saludos`,
      },
    };

    const template = emailTemplates[language as keyof typeof emailTemplates] || emailTemplates.en;
    window.open(`mailto:?subject=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}`);
    
    toast({
      title: language === 'fr' ? 'Client email ouvert' : language === 'es' ? 'Cliente de correo abierto' : 'Email client opened',
    });
  }, [article, language, formatDate, toast]);

  const isInternal = article.url.startsWith('/');
  const wrapperProps = {
    className: "flex-shrink-0 w-[240px] sm:w-[300px] md:w-[340px] block cursor-pointer transition-transform duration-300 hover:-translate-y-2",
    style: { 
      contain: 'layout style paint' as const,
      opacity: 0,
      animation: `newsCardFadeIn 0.4s ease-out ${index * 0.1}s forwards`
    },
  };

  const cardContent = (
    <Card className="h-full overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card">
      <div className="relative group">
        <AspectRatio ratio={16 / 9}>
          <img
            src={article.imageUrl}
            alt={article.title}
            className="object-cover w-full h-full"
            loading="lazy"
            decoding="async"
          />
        </AspectRatio>
        <Badge
          className={`absolute top-3 left-3 ${categoryColors[article.category]} text-white font-semibold border-0`}
        >
          {article.category}
        </Badge>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleShare}
          className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          aria-label="Partager l'article"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      
      <CardContent className="p-4 flex flex-col gap-3">
        <h3 className="font-bold text-base leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {article.title}
        </h3>
        
        <p className="text-sm text-muted-foreground line-clamp-3">
          {article.summary}
        </p>
        
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            <span className="font-medium truncate max-w-[120px]">
              {article.source.name}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(article.publishedAt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // All carousel links open in new tab
  return (
    <a href={isInternal ? `https://crawlers.fr${article.url}` : article.url} target="_blank" rel="noopener noreferrer" {...wrapperProps}>
      {cardContent}
    </a>
  );
}

// Memoize to prevent unnecessary re-renders
export const NewsCard = memo(NewsCardComponent);
