import { memo } from 'react';
import { ExternalLink, BookOpen } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Source {
  title: string;
  url: string;
}

interface SourcesSectionProps {
  sources: Source[];
}

const translations = {
  fr: { title: 'Sources & Références' },
  en: { title: 'Sources & References' },
  es: { title: 'Fuentes y Referencias' },
};

function SourcesSectionComponent({ sources }: SourcesSectionProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  if (sources.length === 0) return null;

  return (
    <div className="mt-10 pt-6 border-t border-border">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">{t.title}</h3>
      </div>
      <ul className="space-y-2">
        {sources.map((source, index) => (
          <li key={index}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="group-hover:underline">{source.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const SourcesSection = memo(SourcesSectionComponent);
