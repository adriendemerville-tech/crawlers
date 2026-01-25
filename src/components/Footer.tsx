import { useLanguage } from '@/contexts/LanguageContext';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-card/50 py-8" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Crawlers AI - crawlers.fr
        </p>
        <p className="text-sm text-muted-foreground">
          {t.footer.alsoDiscover}{' '}
          <a 
            href="https://humanizz.fr" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
            title="Humanizz - Humanisation de contenu IA"
          >
            Humanizz.fr
          </a>{' '}
          - apprenez à rédiger avec l'IA
        </p>
      </div>
    </footer>
  );
}
