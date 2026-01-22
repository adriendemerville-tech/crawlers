import { motion } from 'framer-motion';
import { Calendar, ExternalLink } from 'lucide-react';
import { NewsArticle } from '@/types/news';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface NewsCardProps {
  article: NewsArticle;
  index: number;
}

const categoryColors: Record<string, string> = {
  SEO: 'bg-emerald-500 hover:bg-emerald-600',
  LLM: 'bg-violet-500 hover:bg-violet-600',
  GEO: 'bg-amber-500 hover:bg-amber-600',
};

export function NewsCard({ article, index }: NewsCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="flex-shrink-0 w-[300px] md:w-[340px]"
    >
      <Card className="h-full overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-card">
        <div className="relative">
          <AspectRatio ratio={16 / 9}>
            <img
              src={article.imageUrl}
              alt={article.title}
              className="object-cover w-full h-full"
              loading="lazy"
            />
          </AspectRatio>
          <Badge
            className={`absolute top-3 left-3 ${categoryColors[article.category]} text-white font-semibold border-0`}
          >
            {article.category}
          </Badge>
        </div>
        
        <CardContent className="p-4 flex flex-col gap-3">
          <h3 className="font-bold text-base leading-tight line-clamp-2 text-foreground">
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
    </motion.div>
  );
}
