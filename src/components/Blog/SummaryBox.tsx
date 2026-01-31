import { memo } from 'react';
import { Lightbulb } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SummaryBoxProps {
  points: string[];
}

const translations = {
  fr: { title: 'Ce que vous allez apprendre' },
  en: { title: 'What you will learn' },
  es: { title: 'Lo que aprenderás' },
};

function SummaryBoxComponent({ points }: SummaryBoxProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  return (
    <div className="bg-muted/50 border-l-4 border-primary rounded-r-lg p-5 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-foreground text-base m-0">{t.title}</h2>
      </div>
      <ul className="space-y-2 m-0 p-0 list-none">
        {points.map((point, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="text-primary font-bold mt-0.5">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const SummaryBox = memo(SummaryBoxComponent);
