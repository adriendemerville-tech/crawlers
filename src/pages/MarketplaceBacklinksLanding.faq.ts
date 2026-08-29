export const MARKETPLACE_FAQ = [
  {
    question: 'Comment le prix d’un emplacement de lien est-il calculé ?',
    answer:
      "Le prix est déterministe, jamais négocié : cinq signaux normalisés de 0 à 100 (autorité du domaine, proximité sémantique, trafic réel de la page, qualité éditoriale, visibilité dans les moteurs génératifs) donnent un score global, qui tombe dans un palier P1 à P5. Les paliers vont de 40 € à 350 € et sont arrondis à la dizaine d'euros. Aucun modèle de langage n'intervient dans ce calcul : à signaux identiques, le prix est identique.",
  },
  {
    question: 'Comment savoir si vendre un lien va abîmer mon référencement ?',
    answer:
      "Chaque page reçoit un indice de risque de cession construit sur cinq composantes : valeur stratégique, dépendance du maillage interne, dynamique Search Console, saturation des liens sortants et fragilité technique. Les pages piliers, les pages de conversion et les pages en progression sont exclues d'office. Vous ne pouvez mettre en vente que des pages dont la cession ne coûte rien à votre visibilité.",
  },
  {
    question: 'Le lien vendu est-il en dofollow ou en sponsored ?',
    answer:
      "L'attribut n'est pas un choix commercial, il est décidé par un moteur à deux axes : ce que le besoin de l'acheteur justifie, et ce que la page vendeuse peut supporter. Par défaut le lien est en sponsored. Le dofollow n'est accordé que si le déficit d'autorité de l'acheteur est réel, si l'indice de risque de la page vendeuse est faible, si le palier est au moins P3 et si les plafonds sont libres. La base de décision est enregistrée et auditable.",
  },
  {
    question: 'Quels sont les plafonds d’insertion ?',
    answer:
      'Un seul lien dofollow par page à vie, 20 liens dofollow par domaine sur 12 mois glissants, et 3 insertions maximum par page sur 12 mois glissants tous attributs confondus — un dofollow consomme une de ces trois insertions. Côté acheteur, des fenêtres glissantes limitent le rythme d’acquisition (4 liens sur 30 jours, 2 sur 7 jours, 2 chez un même vendeur sur 12 mois) pour que le profil de liens reste naturel.',
  },
  {
    question: 'Peut-on échanger des liens plutôt que de payer ?',
    answer:
      "Oui, par le troc. La plateforme cherche d'abord une boucle à trois participants ou plus, qui évite tout échange réciproque visible. L'échange direct de lien à lien reste un dernier recours, décoté et différé de 21 jours, avec un quota trimestriel. Une soulte en euros comble l'écart de valeur entre les deux jambes.",
  },
  {
    question: 'Que se passe-t-il si le lien est retiré après la vente ?',
    answer:
      "Chaque lien est contrôlé à J+1, J+7 puis chaque mois jusqu'à la fin de l'engagement (12 mois pour un lien). Aucun constat négatif n'est posé sans escalade de rendu préalable : une page servie en coquille JavaScript ou un blocage de crawl ne valent pas rupture. Si le retrait est confirmé, le remboursement se fait au prorata du reliquat d'engagement, sur le même support de paiement que l'achat.",
  },
  {
    question: 'Quelle commission prend Crawlers.fr ?',
    answer:
      "15 % du montant de la transaction, retenue sur le flux en vente cash. Sur un troc, la commission est due en crédits par chaque jambe, contrôlée avant le figeage de la commande. Les pièces comptables (facture, auto-facturation, avoir) sont figées à l'émission et exigibles à la première preuve de publication.",
  },
] as const;
