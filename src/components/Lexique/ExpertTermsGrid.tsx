import { expertTermsData, expertCategories, ExpertTerm } from '@/data/expertTerms';
import { ExpertTermCard } from './ExpertTermCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { Code2, Shield, Database, Scale } from 'lucide-react';

const categoryIcons = {
  'anti-bot': Shield,
  'data-ai': Database,
  'architecture': Code2,
  'ethics': Scale,
};

export function ExpertTermsGrid() {
  const { language } = useLanguage();
  const terms = expertTermsData[language as keyof typeof expertTermsData] || expertTermsData.fr;

  // Group by category
  const termsByCategory = terms.reduce((acc, term) => {
    if (!acc[term.category]) acc[term.category] = [];
    acc[term.category].push(term);
    return acc;
  }, {} as Record<string, ExpertTerm[]>);

  const translations = {
    fr: {
      title: 'Wiki Expert Crawling',
      subtitle: '20 termes techniques avancés pour maîtriser le web scraping et l\'optimisation GEO',
    },
    en: {
      title: 'Expert Crawling Wiki',
      subtitle: '20 advanced technical terms to master web scraping and GEO optimization',
    },
    es: {
      title: 'Wiki Experto Crawling',
      subtitle: '20 términos técnicos avanzados para dominar el web scraping y la optimización GEO',
    },
  };

  const t = translations[language as keyof typeof translations] || translations.fr;

  return (
    <section className="mb-16">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Code2 className="h-4 w-4" />
          <span className="font-mono">Advanced</span>
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-3">{t.title}</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">{t.subtitle}</p>
      </div>

      {/* Category Sections */}
      {Object.entries(termsByCategory).map(([category, categoryTerms]) => {
        const catMeta = expertCategories[category as keyof typeof expertCategories];
        const Icon = categoryIcons[category as keyof typeof categoryIcons];
        const label = catMeta.label[language as keyof typeof catMeta.label] || catMeta.label.fr;

        return (
          <div key={category} className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${catMeta.color}`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">{label}</h3>
              <span className="text-sm text-muted-foreground">({categoryTerms.length})</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categoryTerms.map((term) => (
                <ExpertTermCard key={term.slug} term={term} language={language} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
