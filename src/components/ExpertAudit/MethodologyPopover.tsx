import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const methodologyTexts: Record<string, string> = {
  global_score: "Le Score Global est calculé sur 200 points en agrégeant six catégories d'analyse : Performance technique, SEO on-page, Sécurité & HTTPS, Accessibilité aux robots, Données structurées et Signaux sociaux. Chaque catégorie contribue au score final selon son impact démontré sur le référencement naturel et la citabilité par les moteurs de réponse IA. Un score supérieur à 150/200 indique un site techniquement solide ; en dessous de 100, des optimisations prioritaires sont identifiées.",
  competitive_landscape: "L'écosystème concurrentiel utilise un scoring de similarité. Le Goliath (Leader) est #1 SERP avec similarité entreprise et produit = 1. Le Concurrent Direct a les mêmes scores mais une position SERP ≥ à la cible. Le Challenger a les mêmes scores mais une position SERP inférieure. L'Inspiration a un score de similarité entreprise ≥ 0.5 et produit ≥ 0.5, et doit être en première page SERP.",
  social_signals: "L'autorité sociale est évaluée en croisant les liens sociaux détectés dans le HTML du site (LinkedIn, Instagram, YouTube, X) avec une recherche SERP du fondateur/dirigeant. Le score E-E-A-T est evidence-based : chaque point est attribué selon des signaux techniques vérifiés (JSON-LD Author, sameAs Wikidata, ProfilePage).",
  market_intelligence: "L'intelligence de marché combine l'analyse sémantique du contenu avec les volumes de recherche DataForSEO. Le niveau de sophistication marketing est évalué sur 5 niveaux, de la présence basique à la stratégie omnicanale avancée. Le gap sémantique compare la couverture thématique par rapport au leader du marché.",
  llm_visibility: "La visibilité LLM est mesurée en interrogeant directement les modèles d'IA (ChatGPT, Claude, Perplexity) sur le domaine et son secteur. Le taux de citation, le sentiment et la précision des réponses sont analysés pour établir un score de citabilité par les moteurs de réponse IA.",
  conversational_intent: "Le test d'intention conversationnelle analyse la structure des titres Hn de la page pour évaluer leur compatibilité avec les requêtes vocales et conversationnelles. Les reformulations sont générées à partir du contenu réel du site pour simuler des questions naturelles d'utilisateurs.",
  zero_click_risk: "La matrice de risque zéro-clic identifie les mots-clés pour lesquels Google affiche une réponse directe (featured snippet, Knowledge Panel, AI Overview) rendant le clic vers le site superflu. Le niveau de risque est calculé par mot-clé en combinant volume, position et type de SERP feature détecté.",
  geo_score: "Le score GEO (Generative Engine Optimization) évalue la capacité du site à être cité par les moteurs de réponse IA. Il combine la structuration sémantique (Schema.org, E-E-A-T), la densité de données factuelles, la fraîcheur du contenu et la couverture des intentions conversationnelles.",
  keyword_positioning: "Le positionnement mots-clés utilise les données DataForSEO en temps réel : volumes de recherche mensuels, difficulté de classement et position organique actuelle du domaine. Les Quick Wins sont les mots-clés en page 2 (positions 11-20) avec un volume significatif.",
  brand_authority: "L'autorité de marque (Brand DNA) analyse l'empreinte numérique de l'entité à travers le Knowledge Graph, les données structurées JSON-LD et les signaux E-E-A-T détectés par le crawler. Le score de Thought Leadership reflète la reconnaissance de l'expertise du fondateur/dirigeant.",
  executive_roadmap: "La feuille de route est générée par l'IA à partir de l'ensemble des données collectées (technique, sémantique, concurrence, E-E-A-T). Chaque recommandation est classée par priorité et catégorie avec un ROI estimé. Les actions sont prescriptives et directement actionnables.",
  priority_content: "L'analyse de contenu prioritaire identifie les pages manquantes à fort potentiel et les contenus existants nécessitant une mise à niveau. Les recommandations sont basées sur les gaps de mots-clés détectés et les intentions de recherche non couvertes.",
  target_queries: "Les requêtes cibles LLM sont générées à partir de l'analyse sémantique du site et calibrées pour tester la citabilité du domaine par les moteurs de réponse IA (ChatGPT, Claude, Perplexity). Chaque requête est associée à un objectif de test spécifique.",
  dark_social: "Le Dark Social Readiness évalue la capacité de votre page à générer des previews riches lorsqu'elle est partagée sur WhatsApp, Slack ou LinkedIn. Le score est calculé sur 100 points : og:image (40 pts, réduit de 50% si format invalide), og:title (30 pts) et og:description (30 pts). Un score élevé maximise le taux de clic sur les liens partagés en messagerie privée.",
  freshness_signals: "L'audit de Preuve de Vie analyse les signaux de fraîcheur du contenu : en-tête HTTP Last-Modified ou balise <meta name='revised'> (50 pts si moins de 6 mois), et mention de l'année courante dans le corps du texte ou le footer (50 pts). Un contenu perçu comme 'frais' par les moteurs IA a plus de chances d'être cité.",
  conversion_friction: "L'analyse de Friction de Conversion évalue le nombre de formulaires, d'inputs visibles par formulaire (optimal : 1 à 3, warning si > 5) et la présence de CTAs dans les 20% supérieurs du DOM (above-the-fold). L'objectif est de détecter les frictions statiques qui réduisent le taux de conversion.",
  quotability: "L'Indice de Citabilité extrait jusqu'à 3 phrases factuelles, autonomes et percutantes que les moteurs IA utiliseraient comme snippets directs. Le score est de 0 à 100 : +33 points par citation de haute qualité identifiée. Un contenu quotable augmente significativement les chances d'être repris par ChatGPT, Perplexity ou Gemini.",
  summary_resilience: "Le Test de Résilience au Résumé évalue si la proposition de valeur principale survit à une compression LLM. L'IA résume le contenu en 10 mots puis compare sémantiquement ce résumé au H1 original. Un score élevé (0-100) signifie que votre message clé reste intact même après reformulation par un LLM.",
  lexical_footprint: "L'Empreinte Lexicale mesure la distance sémantique relative entre le vocabulaire de votre contenu et le niveau de compréhension de chaque cible (primaire, secondaire, potentielle). Un terme technique n'est du 'jargon' que s'il dépasse la compréhension de la cible. Le score d'intentionnalité (hybride algorithmique + IA) croise 4 signaux : agressivité des CTA, alignement SEO des termes techniques, assertivité du ton et cohérence structurelle. Une distance élevée avec une intentionnalité forte = spécialisation assumée.",
  expertise_sentiment: "Le Sentiment d'Expertise évalue le ton E-E-A-T du contenu sur une échelle de 1 à 5 : 1 = contenu générique/IA, 5 = expert de terrain avec marqueurs d'expérience directe ('Nous avons testé', 'Dans notre expérience', 'Étude de cas'). Les LLM favorisent les contenus perçus comme écrits par des experts humains.",
  red_team: "Le Red Teaming simule un prospect sceptique expert qui identifie les 3 plus grandes failles logiques, preuves manquantes ou objections non adressées dans votre contenu. C'est une analyse adversariale qualitative (pas de score numérique) qui révèle les angles morts de votre argumentaire.",
};

interface MethodologyPopoverProps {
  variant: keyof typeof methodologyTexts;
}

export function MethodologyPopover({ variant }: MethodologyPopoverProps) {
  const text = methodologyTexts[variant];
  if (!text) return null;

  return (
    <div className="flex justify-end pt-1">
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            <Info className="h-3 w-3" />
            Méthodologie
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          collisionPadding={16}
          className="w-72 max-h-[50vh] overflow-y-auto p-3 text-xs leading-relaxed text-foreground/90 backdrop-blur-xl bg-background/80 border border-border/50 shadow-xl rounded-lg z-50"
        >
          {text}
        </PopoverContent>
      </Popover>
    </div>
  );
}
