import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const methodologyTexts: Record<string, string> = {
  competitive_landscape: "L'écosystème concurrentiel est construit à partir de données SERP réelles (DataForSEO). Le concurrent direct est identifié par sa position organique immédiatement supérieure à la cible sur les requêtes sectorielles locales. Le leader, le challenger et la source d'inspiration sont déterminés par l'IA à partir de l'analyse sémantique du marché.",
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
