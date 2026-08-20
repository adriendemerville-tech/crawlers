UPDATE public.seo_page_drafts
SET content = content || $md$

## Les requêtes qui comptent pour un consultant indépendant

Un consultant ne se positionne pas sur « consultant » mais sur le problème qu'il résout. La cartographie ci-dessous relie chaque intention à la page qui doit la capter.

| Intention | Forme de requête | Page cible |
|---|---|---|
| Recherche de compétence | consultant + spécialité (« consultant CRM industrie ») | Page d'expertise dédiée |
| Recherche locale | consultant + spécialité + ville | Page zone d'intervention |
| Comparaison de statut | freelance ou cabinet, tarif journalier | Article de fond sur le modèle d'intervention |
| Vérification de crédibilité | nom + prénom, avis, références | Page auteur et études de cas |
| Recherche de méthode | « comment auditer », « quelle méthodologie » | Contenu méthodologique citable |

Une erreur récurrente consiste à concentrer toute l'offre sur une page « Prestations » unique : elle ne peut se classer que sur une intention à la fois. Une page par expertise, reliée à une page pilier, capte chaque intention séparément.

## Les questions que les moteurs génératifs posent sur un consultant

Les modèles ne cherchent pas un site, ils cherchent un prestataire capable de traiter un besoin. Ils reformulent la demande de l'utilisateur en questions de ce type :

- Quel consultant peut m'accompagner sur [problème métier] dans [région] ?
- Quelles sont les méthodes utilisées pour un audit de [domaine] ?
- Combien de temps dure une mission de ce type et comment est-elle facturée ?
- Qui a publié des retours d'expérience documentés sur [sujet] ?
- Quelles certifications ou références justifient cette expertise ?

Pour être cité en réponse, la page doit contenir la réponse sous forme autoportante : un paragraphe qui se comprend hors contexte, avec le périmètre, la durée, le mode de facturation et le nom de l'intervenant. Un tarif journalier caché dans un PDF ou une image n'est jamais repris.

## Les défauts que nos audits relèvent le plus souvent sur les sites de consultants

Les diagnostics réalisés avec Crawlers.fr font remonter les mêmes causes structurelles sur ce profil de site :

1. **Site vitrine rendu en JavaScript** : le contenu n'existe pas dans le HTML servi, donc ni Google ni les robots des IA ne lisent l'offre. C'est le défaut le plus coûteux et le plus fréquent sur les sites construits avec un constructeur visuel.
2. **Aucune entité identifiée** : pas de balisage `Person` ni `ProfilePage`, donc aucune association entre le nom du consultant et son domaine d'expertise.
3. **Page unique sur-chargée** : dix expertises sur une seule URL, aucune ne ressort.
4. **Absence de preuve** : pas d'étude de cas nommée, pas de date, pas de résultat mesurable — l'E-E-A-T repose sur du déclaratif.
5. **Blog abandonné** : des articles anciens non révisés font baisser la fraîcheur perçue de tout le domaine.

Ces cinq points se vérifient en quelques minutes : lancez un audit gratuit et comparez le HTML réellement servi à ce que vous voyez dans votre navigateur.
$md$
WHERE page_type='guide' AND status='published' AND slug='consultant-seo';

UPDATE public.seo_page_drafts
SET content = content || $md$

## Les requêtes qui comptent pour un cabinet médical

La recherche de santé est majoritairement locale et symptomatique. Le vocabulaire du patient n'est pas celui du praticien : c'est cet écart qu'il faut couvrir.

| Intention | Forme de requête | Page cible |
|---|---|---|
| Prise de rendez-vous | spécialité + ville, « rendez-vous rapide » | Page cabinet avec horaires et prise de RDV |
| Symptôme | formulation profane du symptôme | Fiche pathologie rédigée en langage clair |
| Acte technique | nom de l'examen ou de l'intervention | Page acte avec déroulé et durée |
| Prise en charge | conventionnement, remboursement, tarif | Page informations pratiques |
| Vérification | nom du praticien, diplômes | Page praticien avec parcours daté |

Une fiche pathologie qui reprend la nomenclature médicale sans le mot du patient ne capte aucune requête. Les deux registres doivent cohabiter dans la même page, le terme profane dans le titre et l'intertitre, le terme médical dans le corps.

## Les questions que les moteurs génératifs posent sur un cabinet médical

Sur les sujets de santé, les modèles sont prudents et privilégient les sources identifiables et datées. Les questions reformulées ressemblent à :

- Quel praticien consulter pour [symptôme] à [ville] et sous quel délai ?
- Cet acte est-il pris en charge et à quel tarif conventionné ?
- Comment se déroule [examen], combien de temps, quelles précautions ?
- Qui est l'auteur de cette information médicale et quand a-t-elle été mise à jour ?
- Ce cabinet accepte-t-il de nouveaux patients ?

Trois éléments décident de la citation : un auteur identifié avec son titre, une date de révision visible, et une réponse factuelle en tête de page. L'absence de date est le motif d'exclusion le plus fréquent sur les contenus de santé.

## Les défauts que nos audits relèvent le plus souvent sur les sites de cabinets médicaux

1. **Coordonnées et horaires en image** : illisibles pour un robot, ils ne remontent ni dans le pack local ni dans une réponse générative.
2. **Aucun balisage `Physician` ni `MedicalClinic`** : le cabinet n'est pas reconnu comme entité de santé, seulement comme une page web.
3. **Contenu médical non signé et non daté** : incompatible avec les exigences de qualité appliquées aux sujets sensibles.
4. **Fiches pathologies dupliquées** depuis une base documentaire externe : aucune valeur ajoutée, regroupement par le moteur.
5. **Multi-sites de praticiens associés** dupliquant la même adresse et le même texte, sans canonique claire.

Un audit gratuit vous indique lesquels de ces cinq points sont actifs sur votre domaine, à partir du HTML réellement servi aux robots.
$md$
WHERE page_type='guide' AND status='published' AND slug='medecin-seo';

UPDATE public.seo_page_drafts
SET content = content || $md$

## Les requêtes qui comptent pour un photographe

Le marché se segmente par prestation et par lieu, avec une saisonnalité marquée. Une page unique « Tarifs » ne couvre aucune de ces intentions.

| Intention | Forme de requête | Page cible |
|---|---|---|
| Prestation localisée | photographe + prestation + ville | Page service géolocalisée |
| Budget | prix, tarif, forfait + prestation | Page tarifs avec fourchettes réelles |
| Inspiration | style, lieu, « spots photo » | Article ou reportage détaillé |
| Réassurance | avis, portfolio, déroulé de séance | Étude de cas d'un reportage complet |
| Contrainte technique | droit à l'image, livraison, retouches | Page conditions et FAQ |

## Les questions que les moteurs génératifs posent sur un photographe

Un modèle ne peut pas juger une image : il juge le texte qui l'entoure. Les reformulations typiques sont :

- Quel photographe de [prestation] intervient à [ville] et dans quel rayon ?
- Quel budget prévoir pour [prestation] et que comprend la livraison ?
- Combien de temps entre la séance et la réception des fichiers ?
- Quels droits d'utilisation sont cédés avec les photos ?
- Quel est le déroulé d'une séance et faut-il prévoir un repérage ?

Un portfolio sans texte est invisible pour ces réponses. Chaque galerie doit porter un paragraphe autoportant qui nomme la prestation, le lieu, la durée et ce qui est livré.

## Les défauts que nos audits relèvent le plus souvent sur les sites de photographes

1. **Site 100 % visuel** : moins de cent mots indexables par page, donc aucun signal thématique exploitable.
2. **Images non optimisées** : fichiers d'origine non compressés qui dégradent le LCP mobile — souvent le premier frein au classement local.
3. **Noms de fichiers et alternatives absents** : `IMG_4523.jpg` sans attribut alt ne dit rien du sujet ni du lieu.
4. **Aucun balisage `ImageObject` ni `LocalBusiness`** : ni crédit auteur, ni zone d'intervention déclarée.
5. **Galeries chargées en JavaScript après le rendu** : les robots ne voient qu'une coquille vide.

Ces points sont mesurables : l'audit gratuit compare le poids réel des images, le texte indexable par page et le balisage servi.
$md$
WHERE page_type='guide' AND status='published' AND slug='photographe-seo';

UPDATE public.seo_page_drafts
SET content = content || $md$

## Les requêtes qui comptent pour un restaurant

La recherche de restaurant est immédiate, mobile et fortement contextuelle : lieu, moment, contrainte alimentaire. Chaque contrainte est une requête distincte.

| Intention | Forme de requête | Page cible |
|---|---|---|
| Proximité immédiate | « restaurant ouvert maintenant » + quartier | Fiche établissement avec horaires structurés |
| Type de cuisine | cuisine + ville, spécialité régionale | Page carte détaillée en texte |
| Contrainte alimentaire | végétarien, sans gluten, halal | Page menu avec mentions explicites |
| Occasion | groupe, anniversaire, repas d'affaires | Page privatisation et grandes tables |
| Réservation | réserver + nom ou quartier | Page réservation sans redirection tierce |

Une carte publiée en PDF ou en image est le point de fuite le plus commun : ni le moteur ni l'IA ne lisent les plats, donc aucune requête de spécialité ne peut être captée.

## Les questions que les moteurs génératifs posent sur un restaurant

- Quel restaurant [type de cuisine] est ouvert [créneau] à [quartier] ?
- Y a-t-il des options végétariennes ou sans gluten à la carte ?
- Quel est le prix moyen d'un déjeuner et existe-t-il une formule ?
- Peut-on venir en groupe de dix personnes et faut-il réserver ?
- Le service est-il possible en terrasse et l'accès est-il adapté ?

Chacune de ces réponses doit exister en texte sur le site, pas seulement dans une fiche externe. Un établissement dont les informations n'existent que sur une plateforme de réservation laisse cette plateforme récolter la citation.

## Les défauts que nos audits relèvent le plus souvent sur les sites de restaurants

1. **Carte en PDF ou en image** : contenu principal totalement absent de l'index.
2. **Horaires incohérents** entre le site, la fiche d'établissement et les plateformes : signal de fiabilité dégradé.
3. **Aucun balisage `Restaurant` ni `Menu`** : pas de fourchette de prix ni de type de cuisine déclarés.
4. **Site vitrine rendu en JavaScript** ou animation lourde en page d'accueil : LCP mobile très dégradé sur un trafic quasi exclusivement mobile.
5. **Réservation déléguée** sans page propre : tout le signal de conversion part vers un domaine tiers.

L'audit gratuit vérifie chacun de ces points sur le HTML réellement servi, y compris la présence effective de la carte en texte.
$md$
WHERE page_type='guide' AND status='published' AND slug='restaurant-seo';
