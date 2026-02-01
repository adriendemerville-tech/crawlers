import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

interface AuthorCardProps {
  name: string;
  avatarUrl?: string;
  position?: 'top' | 'bottom';
}

const translations = {
  fr: { by: 'Par', viewProfile: 'Voir le profil', role: 'Expert SEO & GEO' },
  en: { by: 'By', viewProfile: 'View profile', role: 'SEO & GEO Expert' },
  es: { by: 'Por', viewProfile: 'Ver perfil', role: 'Experto SEO & GEO' },
};

function AuthorCardComponent({ name, avatarUrl, position = 'top' }: AuthorCardProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3b82f6&color=fff&size=96`;

  return (
    <div className={`flex items-center gap-4 ${position === 'bottom' ? 'mt-10 pt-6 border-t border-border' : 'mb-6'}`}>
      <Link to={`/auteur/${name.toLowerCase()}`} className="shrink-0">
        <img
          src={avatarUrl || defaultAvatar}
          alt={`Photo de ${name}`}
          className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20 hover:ring-primary/50 transition-all"
          loading="lazy"
        />
      </Link>
      <div className="flex flex-col">
        <Link 
          to={`/auteur/${name.toLowerCase()}`}
          className="font-semibold text-foreground hover:text-primary transition-colors"
        >
          {t.by} {name}
        </Link>
        <span className="text-sm text-muted-foreground">{t.role}</span>
      </div>
    </div>
  );
}

export const AuthorCard = memo(AuthorCardComponent);
