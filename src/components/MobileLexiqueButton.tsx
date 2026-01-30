import { Link } from 'react-router-dom';
import { Book } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const lexiqueLabels = {
  fr: 'Lexique SEO & GEO',
  en: 'SEO & GEO Glossary',
  es: 'Glosario SEO & GEO',
};

export function MobileLexiqueButton() {
  const { language } = useLanguage();

  return (
    <div className="sm:hidden flex justify-center py-6">
      <Link to="/lexique">
        <Button
          variant="outline"
          size="lg"
          className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
        >
          <Book className="h-5 w-5 text-primary" />
          <span className="font-medium">{lexiqueLabels[language]}</span>
        </Button>
      </Link>
    </div>
  );
}
