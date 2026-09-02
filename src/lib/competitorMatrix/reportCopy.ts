// Chapeaux pédagogiques du rapport de matrice de concurrence.
// Une phrase par section : ce qui est mesuré, comment le lire, ce que ça ne dit pas.

export const SECTION_LEADS = {
  verdict:
    'Le verdict résume une seule chose : votre part des requêtes qui font vivre votre marché. Il est calculé sur les relevés réellement effectués, et rétrogradé quand des chantiers prioritaires bloquent le reste.',
  kpis:
    'Cinq chiffres suffisent à situer une entreprise sur son marché : ce qu’elle couvre, ce qu’un concurrent lui prend, ce que les IA disent d’elle, et le volume de recherche qui lui échappe.',
  actions:
    'Les actions sont classées par ordre de rentabilité, pas par ordre de difficulté. P1 se traite d’abord : ce sont les positions déjà à portée ou les requêtes que vos concurrents captent seuls. P2 construit la visibilité dans les réponses d’IA. P3 prend le terrain libre.',
  leaderboard:
    'Ce classement compare la couverture de chaque acteur sur les mêmes requêtes. Un domaine avec peu de requêtes couvertes mais une position moyenne forte est un spécialiste ; l’inverse est un généraliste qui vous dépasse par le volume.',
  gaps:
    'Ces requêtes sont couvertes par un leader et pas par vous, ou vous y êtes trop bas pour être vu. Elles sont classées par rentabilité : le volume de recherche pondéré par la distance qui vous sépare du top 10 et par la difficulté de la requête. Le haut du tableau se traite d’abord.',

  semantic:
    'Comment chaque page d’accueil se présente aux moteurs et aux IA : structure Hn, balisage Schema.org et passages citables, relevés sur le HTML servi. Un score faible plafonne la citabilité, il ne garantit rien en position.',

  aiOverviews:
    'Sur ces requêtes, Google rédige la réponse et cite ses sources avant tout lien organique. Y être classé ne suffit plus : ne pas être cité revient à ne pas exister sur la requête.',
  matrix:
    'La matrice complète sert de pièce justificative : une ligne par requête, l’état de chaque acteur, la position Google et le taux de citation IA quand ils ont été mesurés.',
  method:
    'Ce rapport ne contient aucune estimation extrapolée. Chaque case provient d’un relevé daté ; ce qui n’a pas été mesuré est déclaré comme tel.',
} as const;

export const VERDICT_HINT =
  'Indice de présence : part des requêtes du marché couvertes, une requête faiblement couverte comptant pour moitié.';
