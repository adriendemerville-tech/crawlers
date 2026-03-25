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
    content: `🔬 **Le Workflow Micro — Analyse page par page**\n\n` +
      `C'est le point de départ idéal. Tu colles une URL, et Crawlers fait le reste :\n\n` +
      `1️⃣ **Audit Expert** — On passe ta page au peigne fin : SEO technique, qualité du contenu, performance, accessibilité, données structurées, et même ta visibilité dans les moteurs IA. Tu obtiens un score sur 200 avec des recommandations concrètes.\n\n` +
      `2️⃣ **Architecte Génératif** — À partir des résultats de l'audit, l'IA génère directement le code correctif (balises, schema.org, méta-données…) et un plan d'action priorisé que tu peux déployer en un clic.\n\n` +
      `👉 Pour essayer, va dans **Audit** et colle n'importe quelle URL !`,
    timestamp: now,
  });

  // Workflow 2 — Macro (multi-pages)
  msgs.push({
    role: 'assistant',
    content: `🌐 **Le Workflow Macro — Vision globale multi-pages**\n\n` +
      `Quand tu veux analyser ton site dans son ensemble, voilà comment ça fonctionne :\n\n` +
      `1️⃣ **Crawl Multi-Pages** — On scanne jusqu'à 50 pages de ton site d'un coup. Tu obtiens un score SEO par page, la détection des erreurs techniques, les pages orphelines, le poids moyen, et une synthèse IA globale.\n\n` +
      `2️⃣ **Cocoon** — Le crawl alimente un graphe interactif de ton maillage interne. Tu visualises la structure de ton site en 3D ou en vue radiale, et l'IA te propose des liens internes optimisés pour renforcer ton cocon sémantique.\n\n` +
      `3️⃣ **Architecte** — Depuis le crawl ou le cocoon, tu peux générer des corrections à l'échelle du site entier : restructuration, nouveaux contenus, optimisation du maillage.\n\n` +
      `👉 Commence par lancer un **Crawl** dans le menu pour voir ton site sous un nouvel angle !`,
    timestamp: now,
  });

  // Freelance-specific: Matrice
  if (persona === 'freelance' || persona === 'agency') {
    msgs.push({
      role: 'assistant',
      content: `💼 **Ton outil pro — La Matrice de Prompts**\n\n` +
        `En tant que professionnel, tu as accès à un outil pensé pour scaler ton activité :\n\n` +
        `La **Matrice** te permet de générer des briefs SEO structurés et des recommandations personnalisées pour chacun de tes clients, en quelques clics. ` +
        `Tu importes tes URLs, tu choisis le type d'analyse, et l'IA produit des rapports prêts à livrer.\n\n` +
        `C'est l'idéal quand tu gères plusieurs sites et que tu veux industrialiser tes audits sans sacrifier la qualité.\n\n` +
        `👉 Tu la trouveras dans le menu **Matrice** !`,
      timestamp: now,
    });
  }

  // Transition to diagnostic
  msgs.push({
    role: 'assistant',
    content: `Avant de commencer, j'aimerais mieux te connaître pour adapter mon accompagnement 👇`,
    timestamp: now,
  });

  return msgs;

  return msgs;
}
