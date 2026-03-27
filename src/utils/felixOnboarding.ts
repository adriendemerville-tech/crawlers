/**
 * Felix onboarding tour content.
 * Flow: Bonjour ! → Présentation → Avant de commencer → autonomy quiz
 */

const STORAGE_KEY = 'felix_onboarding_done';

export function isOnboardingDone(): boolean {
  return !!localStorage.getItem(STORAGE_KEY);
}

export function markOnboardingDone(): void {
  localStorage.setItem(STORAGE_KEY, '1');
}

export interface OnboardingMessage {
  role: 'assistant';
  content: string;
  timestamp: string;
}

export function getOnboardingMessages(_persona: string | null): OnboardingMessage[] {
  const now = new Date().toISOString();

  return [
    {
      role: 'assistant',
      content: `Bonjour ! 👋`,
      timestamp: now,
    },
    {
      role: 'assistant',
      content: `Moi c'est **Félix**, ton assistant SEO & GEO sur Crawlers.fr. Je suis là pour t'aider à comprendre tes audits, optimiser ta visibilité et répondre à toutes tes questions.`,
      timestamp: now,
    },
    {
      role: 'assistant',
      content: `Avant de commencer, j'aimerais mieux te connaître pour adapter mon accompagnement 👇`,
      timestamp: now,
    },
  ];
}
