import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

const translations = {
  fr: { weak: 'Faible', medium: 'Moyen', strong: 'Fort' },
  en: { weak: 'Weak', medium: 'Medium', strong: 'Strong' },
  es: { weak: 'Débil', medium: 'Medio', strong: 'Fuerte' },
};

export type PasswordStrength = 'weak' | 'medium' | 'strong' | null;

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return 'weak';
  if (score <= 2) return 'medium';
  return 'strong';
}

export function isPasswordAcceptable(password: string): boolean {
  return getPasswordStrength(password) !== 'weak' && password.length >= 6;
}

interface PasswordStrengthBarProps {
  password: string;
  compact?: boolean;
}

export function PasswordStrengthBar({ password, compact = false }: PasswordStrengthBarProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  if (!strength) return null;

  const config = {
    weak: { color: 'bg-destructive', width: '33%', label: t.weak, textColor: 'text-destructive' },
    medium: { color: 'bg-yellow-500', width: '66%', label: t.medium, textColor: 'text-yellow-500' },
    strong: { color: 'bg-green-500', width: '100%', label: t.strong, textColor: 'text-green-500' },
  };

  const c = config[strength];

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      <div className={`w-full rounded-full bg-muted ${compact ? 'h-1' : 'h-1.5'}`}>
        <motion.div
          className={`${c.color} rounded-full ${compact ? 'h-1' : 'h-1.5'}`}
          initial={{ width: 0 }}
          animate={{ width: c.width }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <p className={`${c.textColor} ${compact ? 'text-[10px]' : 'text-xs'} font-medium`}>{c.label}</p>
    </div>
  );
}
