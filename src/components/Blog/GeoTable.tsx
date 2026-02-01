import { memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export interface GeoTableRow {
  factor: { fr: string; en: string; es: string };
  seo: { fr: string; en: string; es: string };
  geo: { fr: string; en: string; es: string };
  importance: 'essential' | 'important' | 'optional';
}

interface GeoTableProps {
  rows: GeoTableRow[];
  caption?: { fr: string; en: string; es: string };
}

const translations = {
  fr: { factor: 'Facteur', seo: 'SEO Classique', geo: 'GEO (IA)', importance: 'Niveau' },
  en: { factor: 'Factor', seo: 'Classic SEO', geo: 'GEO (AI)', importance: 'Level' },
  es: { factor: 'Factor', seo: 'SEO Clásico', geo: 'GEO (IA)', importance: 'Nivel' },
};

const importanceLabels = {
  essential: { fr: 'Essentiel', en: 'Essential', es: 'Esencial' },
  important: { fr: 'Important', en: 'Important', es: 'Importante' },
  optional: { fr: 'Optionnel', en: 'Optional', es: 'Opcional' },
};

const importanceColors = {
  essential: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  important: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-400',
  optional: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function GeoTableComponent({ rows, caption }: GeoTableProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  return (
    <div className="my-8 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption && (
          <caption className="text-left text-base font-semibold text-foreground mb-3">
            {caption[language] || caption.fr}
          </caption>
        )}
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="text-left p-3 font-semibold text-foreground">{t.factor}</th>
            <th className="text-left p-3 font-semibold text-foreground">{t.seo}</th>
            <th className="text-left p-3 font-semibold text-foreground">{t.geo}</th>
            <th className="text-center p-3 font-semibold text-foreground">{t.importance}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr 
              key={index} 
              className={`border-b border-border/50 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
            >
              <td className="p-3 font-medium text-foreground">
                {row.factor[language] || row.factor.fr}
              </td>
              <td className="p-3 text-muted-foreground">
                {row.seo[language] || row.seo.fr}
              </td>
              <td className="p-3 text-muted-foreground">
                {row.geo[language] || row.geo.fr}
              </td>
              <td className="p-3 text-center">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${importanceColors[row.importance]}`}>
                  {importanceLabels[row.importance][language] || importanceLabels[row.importance].fr}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const GeoTable = memo(GeoTableComponent);
