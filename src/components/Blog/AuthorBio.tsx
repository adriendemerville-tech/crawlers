import { memo } from 'react';
import { Linkedin, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AuthorBioProps {
  author?: string;
}

const translations = {
  fr: {
    about: 'À propos de l\'auteur',
    bio: 'Adrien est expert en SEO et Visibility Engineering. Passionné par l\'intersection entre l\'IA générative et le référencement, il aide les entreprises à optimiser leur présence digitale pour les moteurs de recherche traditionnels et les nouveaux moteurs génératifs (ChatGPT, Perplexity, Claude).',
  },
  en: {
    about: 'About the author',
    bio: 'Adrien is an expert in SEO and Visibility Engineering. Passionate about the intersection of generative AI and search optimization, he helps businesses optimize their digital presence for traditional search engines and new generative engines (ChatGPT, Perplexity, Claude).',
  },
  es: {
    about: 'Sobre el autor',
    bio: 'Adrien es experto en SEO e Ingeniería de Visibilidad. Apasionado por la intersección entre la IA generativa y el posicionamiento web, ayuda a las empresas a optimizar su presencia digital para los motores de búsqueda tradicionales y los nuevos motores generativos (ChatGPT, Perplexity, Claude).',
  },
};

function AuthorBioComponent({ author = 'Adrien' }: AuthorBioProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        {t.about}
      </h3>
      <div className="flex gap-4">
        <div className="shrink-0">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-xl">
            A
          </div>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-foreground mb-2">{author}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {t.bio}
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/in/adrien-de-volontat/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
            </a>
            <a
              href="https://crawlers.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="Website"
            >
              <Globe className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export const AuthorBio = memo(AuthorBioComponent);
