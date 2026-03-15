import { Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';

const translations = {
  fr: 'Mode consultation — Vous pouvez tout voir mais les actions sont désactivées.',
  en: 'Read-only mode — You can view everything but actions are disabled.',
  es: 'Modo consulta — Puedes ver todo pero las acciones están desactivadas.',
};

export function ReadOnlyBanner() {
  const { language } = useLanguage();
  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <Eye className="h-4 w-4 text-amber-500" />
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        {translations[language] || translations.fr}
      </AlertDescription>
    </Alert>
  );
}
