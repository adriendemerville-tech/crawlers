/**
 * Centralized translation helper for trilingual support (FR/EN/ES).
 * Replaces duplicated t3() functions across the codebase.
 */
export const t3 = (language: string, fr: string, en: string, es: string): string =>
  language === 'fr' ? fr : language === 'es' ? es : en;
