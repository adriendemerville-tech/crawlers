import { memo } from 'react';
import { Bot } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SgeSummaryBoxProps {
  points: string[];
}

const translations = {
  fr: { title: "Ce que l'IA retient de cet article :" },
  en: { title: 'What AI retains from this article:' },
  es: { title: 'Lo que la IA retiene de este artículo:' },
};

function SgeSummaryBoxComponent({ points }: SgeSummaryBoxProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 border-l-4 border-blue-600 rounded-r-lg p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="h-5 w-5 text-blue-600" />
        <h2 className="font-bold text-foreground text-base m-0">{t.title}</h2>
      </div>
      <ul className="space-y-2 m-0 p-0 list-none">
        {points.map((point, index) => (
          <li key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs font-bold shrink-0 mt-0.5">
              {index + 1}
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const SgeSummaryBox = memo(SgeSummaryBoxComponent);
