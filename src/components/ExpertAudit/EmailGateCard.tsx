import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mail, Unlock, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const translations = {
  fr: {
    title: 'Débloquez votre rapport complet',
    subtitle: 'Entrez votre email pour accéder à l\'analyse détaillée et aux recommandations personnalisées.',
    placeholder: 'votre@email.com',
    button: 'Accéder au rapport',
    privacy: 'Vos données restent confidentielles. Aucun spam.',
  },
  en: {
    title: 'Unlock your full report',
    subtitle: 'Enter your email to access the detailed analysis and personalized recommendations.',
    placeholder: 'your@email.com',
    button: 'Access report',
    privacy: 'Your data stays confidential. No spam.',
  },
  es: {
    title: 'Desbloquea tu informe completo',
    subtitle: 'Ingresa tu email para acceder al análisis detallado y recomendaciones personalizadas.',
    placeholder: 'tu@email.com',
    button: 'Acceder al informe',
    privacy: 'Tus datos permanecen confidenciales. Sin spam.',
  },
};

interface EmailGateCardProps {
  onEmailSubmit: (email: string) => void;
}

export function EmailGateCard({ onEmailSubmit }: EmailGateCardProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    
    setIsSubmitting(true);
    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));
    onEmailSubmit(email.trim());
    setIsSubmitting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-20 flex items-center justify-center"
    >
      <Card className="w-full max-w-md mx-4 border-2 border-primary/30 shadow-2xl bg-card/95 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{t.title}</h3>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder={t.placeholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11 h-12 text-base"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium gap-2"
              disabled={isSubmitting || !email.includes('@')}
            >
              <Unlock className="h-4 w-4" />
              {t.button}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            {t.privacy}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
