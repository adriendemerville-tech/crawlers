import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';

interface RichLinkCardProps {
  href: string;
  title: string;
  description: string;
  imageUrl?: string;
}

function RichLinkCardComponent({ href, title, description, imageUrl }: RichLinkCardProps) {
  const isExternal = href.startsWith('http');
  const Component = isExternal ? 'a' : Link;
  const linkProps = isExternal 
    ? { href, target: '_blank', rel: 'noopener noreferrer' }
    : { to: href };

  return (
    <Component
      {...(linkProps as any)}
      className="group flex items-stretch gap-4 my-8 p-4 rounded-xl border border-border bg-gradient-to-r from-muted/30 to-muted/10 hover:from-primary/10 hover:to-primary/5 hover:border-primary/30 transition-all duration-300 no-underline"
    >
      {/* Image ou icône */}
      <div className="shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <FileText className="w-7 h-7 text-primary" />
        )}
      </div>
      
      {/* Contenu */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-base mb-1 line-clamp-1">
          {title}
        </h4>
        <p className="text-sm text-muted-foreground line-clamp-2 m-0">
          {description}
        </p>
      </div>
      
      {/* Flèche */}
      <div className="shrink-0 flex items-center">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-300">
          <ArrowRight className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
        </div>
      </div>
    </Component>
  );
}

export const RichLinkCard = memo(RichLinkCardComponent);
