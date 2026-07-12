import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Linkedin, Globe, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import adrienPhoto from '@/assets/adrien-de-volontat.jpg';

interface AuthorBioProps {
  author?: string;
}

const translations = {
  fr: {
    about: 'À propos de l\'auteur',
    bio: 'Adrien de Volontat est fondateur de Crawlers.fr, plateforme française d\'audit SEO & GEO. Il conçoit les méthodologies d\'audit et les algorithmes qui permettent aux sites d\'améliorer leur visibilité sur Google et les moteurs génératifs (ChatGPT, Perplexity, Claude, Gemini).',
    profile: 'Profil complet',
  },
  en: {
    about: 'About the author',
    bio: 'Adrien de Volontat is the founder of Crawlers.fr, a French SEO & GEO audit platform. He designs the audit methodologies and algorithms that help websites improve visibility on Google and generative engines (ChatGPT, Perplexity, Claude, Gemini).',
    profile: 'Full profile',
  },
  es: {
    about: 'Sobre el autor',
    bio: 'Adrien de Volontat es fundador de Crawlers.fr, plataforma francesa de auditoría SEO & GEO. Diseña las metodologías de auditoría y los algoritmos que permiten a los sitios mejorar su visibilidad en Google y motores generativos (ChatGPT, Perplexity, Claude, Gemini).',
    profile: 'Perfil completo',
  },
};

function AuthorBioComponent({ author = 'Adrien' }: AuthorBioProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const displayName = author.toLowerCase().includes('adrien') ? 'Adrien de Volontat' : author;
  const authorUrl = '/auteur/adrien-de-volontat';

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        {t.about}
      </h3>
      <div className="flex gap-4">
        <Link to={authorUrl} className="shrink-0">
          <img
            src={adrienPhoto}
            alt={`Photo de ${displayName}`}
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/20 hover:ring-primary/50 transition-all"
            loading="lazy"
          />
        </Link>
        <div className="flex-1">
          <h4 className="font-semibold text-foreground mb-2">
            <Link to={authorUrl} className="hover:text-primary transition-colors">
              {displayName}
            </Link>
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {t.bio}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://www.linkedin.com/in/adrien-de-volontat/"
              target="_blank"
              rel="noopener noreferrer me"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
            </a>
            <a
              href="https://crawlers.fr"
              rel="me"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="Website"
            >
              <Globe className="h-4 w-4" />
            </a>
            <Link
              to={authorUrl}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t.profile} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export const AuthorBio = memo(AuthorBioComponent);
