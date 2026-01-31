import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

interface RichLinkProps {
  href: string;
  title: string;
  description?: string;
  external?: boolean;
}

function RichLinkComponent({ href, title, description, external = false }: RichLinkProps) {
  const content = (
    <div className="group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-6 my-8 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-colors" />
      
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors m-0">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1 m-0">{description}</p>
            )}
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline block">
        {content}
      </a>
    );
  }

  return (
    <Link to={href} className="no-underline block">
      {content}
    </Link>
  );
}

export const RichLink = memo(RichLinkComponent);
