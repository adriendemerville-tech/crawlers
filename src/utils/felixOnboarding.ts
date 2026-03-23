/**
 * Felix onboarding tour content.
 * Generates the guided messages based on user persona.
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

export function getOnboardingMessages(persona: string | null): OnboardingMessage[] {
  const now = new Date().toISOString();
  const msgs: OnboardingMessage[] = [];

  // Welcome
  msgs.push({
    role: 'assistant',
    content: `👋 **Salut, moi c'est Félix !** Bienvenue sur Crawlers.fr !\n\nJe serai toujours là pour te filer un coup de main. Tu veux que je te montre comment ça marche ?`,
    timestamp: now,
  });

  // Workflow 1 — Micro (page par page)
  msgs.push({
    role: 'assistant',
    content: `🔬 **Workflow Micro — Page par page**\n\n` +
      `Le cœur de Crawlers, c'est l'analyse page par page :\n\n` +
      `1️⃣ **Audit Expert** → Analyse complète d'une URL (SEO technique, contenu, performance, IA)\n` +
      `2️⃣ **Architecte Génératif** → Génère le code correctif et le plan d'action à partir de l'audit\n\n` +
      `👉 Commence par coller une URL dans l'**Audit Expert** pour voir la magie opérer !`,
    timestamp: now,
  });

  // Workflow 2 — Macro (multi-pages)
  msgs.push({
    role: 'assistant',
    content: `🌐 **Workflow Macro — Multi-pages**\n\n` +
      `Pour une vision globale de ton site :\n\n` +
      `1️⃣ **Crawl** → Scanne toutes les pages de ton site (liens, titres, erreurs…)\n` +
      `2️⃣ **Cocoon** → Visualise le maillage interne en graphe interactif et optimise la structure\n` +
      `3️⃣ **Architecte Génératif** ou **Architecte Content** → Génère les corrections à l'échelle du site\n\n` +
      `👉 Lance un **Crawl** pour démarrer l'analyse multi-pages !`,
    timestamp: now,
  });

  // Freelance-specific: Matrice
  if (persona === 'freelance' || persona === 'agency') {
    msgs.push({
      role: 'assistant',
      content: `💼 **Bonus Freelance / Agence — Matrice de Prompts**\n\n` +
        `En tant que pro, tu as aussi accès à la **Matrice** :\n\n` +
        `📊 Génère des briefs SEO structurés pour tes clients en quelques clics. ` +
        `Idéal pour produire des recommandations à grande échelle.\n\n` +
        `👉 Retrouve-la dans le menu **Matrice** !`,
      timestamp: now,
    });
  }

  // Closing
  msgs.push({
    role: 'assistant',
    content: `C'est tout pour le tour ! N'hésite pas à me poser des questions à tout moment 😊\n\nBonne exploration ! 🚀`,
    timestamp: now,
  });

  return msgs;
}
