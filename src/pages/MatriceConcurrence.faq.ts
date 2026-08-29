export const MATRIX_FAQS: { q: string; a: string }[] = [
  {
    q: 'Qui sont vraiment mes concurrents ?',
    a: "Trois familles cohabitent et l'outil les distingue. Le concurrent métier vend le même produit ou le même service sur le même marché, qu'il soit visible ou non. Le concurrent de visibilité occupe la SERP et les réponses d'IA sur vos requêtes sans forcément proposer la même offre. Le concurrent silencieux propose la même offre mais n'apparaît nulle part : il ne vous prend pas de trafic aujourd'hui, il vous prend des clients hors ligne. Les substituts fonctionnels et les grandes plateformes dominantes sont listés à part, car ils faussent la lecture d'une matrice de mots-clés.",
  },
  {
    q: 'Comment la citation dans ChatGPT, Gemini et Claude est-elle mesurée ?',
    a: "Chaque mot-clé est posé 3 fois à chaque moteur (ChatGPT, Gemini, Claude), soit 9 réponses par mot-clé. L'outil compte dans combien de ces réponses chaque domaine est cité, et affiche un taux, pas un tirage unique. Exemple pour le mot-clé « meilleur outil marketing référencement » : itération 1 — ChatGPT cite concurrentA.fr, Gemini cite concurrentB.fr, Claude ne cite personne ; itération 2 — ChatGPT cite concurrentA.fr, Gemini ne cite personne, Claude cite votre-site.fr ; itération 3 — ChatGPT ne cite personne, Gemini cite concurrentB.fr, Claude cite votre-site.fr. Votre domaine est cité 2 fois sur 9 : taux de citation IA ≈ 22 %. Une marque citée une seule fois n'est pas une marque visible : la répétition sépare la citation stable du hasard.",
  },
  {
    q: 'Que signifie la ligne AI Overviews position 0 ?',
    a: "Pour chaque mot-clé, l'outil relève si Google déclenche un AI Overview et quels domaines y sont cités comme sources. Ces domaines captent la réponse avant tout clic organique. Un mot-clé où un AI Overview se déclenche sans vous citer est une perte de visibilité qui n'apparaît dans aucun suivi de position classique.",
  },
  {
    q: 'Pourquoi certaines cases affichent « non mesuré » ?',
    a: "Parce qu'une donnée manquante n'est pas une absence. La mesure de citation IA porte sur les dix mots-clés à plus forte valeur, pour garder l'outil gratuit. Les autres cases restent explicitement non mesurées plutôt que d'être comptées comme un échec.",
  },
];
