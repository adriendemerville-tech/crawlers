import { useState } from 'react';
import { ChevronDown, ChevronUp, GraduationCap, Target, Lightbulb, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelpButton } from '@/components/HelpButton';

interface EducationalContent {
  concept: string;
  impact: string;
  action: string;
  lexiqueTerm?: string;
}

interface InsightEducationalPanelProps {
  type: 'semantic' | 'density' | 'links' | 'jsonld';
  data?: {
    similarity?: number;
    ratio?: number;
    internalLinks?: number;
    externalLinks?: number;
    jsonLdCount?: number;
  };
}

const getEducationalContent = (
  type: InsightEducationalPanelProps['type'],
  data?: InsightEducationalPanelProps['data']
): EducationalContent => {
  switch (type) {
    case 'semantic':
      return {
        concept: `La cohérence Title/H1 mesure l'alignement sémantique entre le titre de votre page (affiché dans Google) et le titre principal visible sur votre page (balise H1). Imaginez-le comme la promesse (Title) et la livraison (H1) : ils doivent parler du même sujet.`,
        impact: `Google analyse cette cohérence pour évaluer la pertinence de votre page. Une similarité de ${data?.similarity || 75}% indique un excellent équilibre : vous êtes cohérent tout en variant suffisamment pour enrichir le champ sémantique. Les moteurs de réponse IA (ChatGPT, Gemini, Perplexity) utilisent cette cohérence pour comprendre le sujet principal de votre page et décider de vous citer.`,
        action: data?.similarity === 100 
          ? `Votre Title et H1 sont identiques. Variez légèrement le H1 pour enrichir le champ lexical tout en restant cohérent.`
          : data?.similarity && data.similarity < 50
          ? `La cohérence est faible. Rapprochez votre H1 du Title pour renforcer le signal sémantique principal.`
          : `Excellent équilibre ! Maintenez cette stratégie de variation contrôlée entre Title et H1.`,
        lexiqueTerm: 'balise-title'
      };
    
    case 'density':
      return {
        concept: `Le ratio Code/Texte compare la quantité de contenu visible par les utilisateurs (texte) versus le code technique (HTML, CSS, JavaScript). C'est comme mesurer le "bruit" technique par rapport au "signal" utile. Un ratio de ${data?.ratio || 9}% signifie que seulement ${data?.ratio || 9}% de votre page est du contenu lisible.`,
        impact: `Google et les LLM pénalisent le "Thin Content" (contenu pauvre). Un ratio inférieur à 15% déclenche des alertes algorithmiques. Les moteurs de réponse IA peinent à extraire des informations pertinentes d'une page trop légère en texte. Votre page risque d'être ignorée par ChatGPT et Gemini lors de leurs recherches.`,
        action: data?.ratio && data.ratio < 15
          ? `Urgent : Ajoutez du contenu textuel substantiel. Visez au minimum 300 mots de texte unique et pertinent. Réduisez les scripts inutiles et optimisez votre HTML.`
          : data?.ratio && data.ratio < 25
          ? `Votre ratio est acceptable mais pourrait être amélioré. Enrichissez votre contenu textuel pour mieux performer en GEO.`
          : `Excellent ratio ! Votre page offre un bon équilibre entre contenu et code technique.`,
        lexiqueTerm: 'thin-content'
      };
    
    case 'links':
      return {
        concept: `Le profil de liens analyse le maillage de votre page : combien de liens internes (vers d'autres pages de votre site) et externes (vers d'autres sites) contient-elle ? C'est comme cartographier les "routes" que Google et les IA peuvent emprunter depuis cette page.`,
        impact: `Le maillage interne transmet le "PageRank" et aide Google à comprendre l'architecture de votre site. Les liens externes de qualité renforcent votre crédibilité (E-E-A-T). Avec ${data?.internalLinks || 1} lien(s) interne(s) et ${data?.externalLinks || 0} lien(s) externe(s), votre page est isolée. Les LLM ont besoin de contexte relationnel pour vous recommander.`,
        action: data?.internalLinks && data.internalLinks < 3
          ? `Ajoutez 3 à 5 liens internes pertinents vers vos pages importantes. Créez au moins 1 lien externe vers une source de référence pour renforcer votre crédibilité.`
          : `Bon maillage ! Assurez-vous que les ancres de liens sont descriptives et évitez les "cliquez ici" qui nuisent au SEO.`,
        lexiqueTerm: 'maillage-interne'
      };
    
    case 'jsonld':
      return {
        concept: `Les données structurées JSON-LD sont un code spécial qui "traduit" votre contenu en langage compréhensible par les machines. C'est comme ajouter une notice explicative à votre page : "Ceci est un article rédigé par X, publié le Y, traitant de Z".`,
        impact: `Sans Schema.org, Google et les LLM doivent "deviner" le contexte de votre page. Avec ${data?.jsonLdCount || 0} script(s) détecté(s), vous passez à côté des résultats enrichis (étoiles, FAQ, images) et les moteurs de réponse IA manquent du contexte nécessaire pour vous citer correctement.`,
        action: data?.jsonLdCount === 0
          ? `Priorité haute : Implémentez au minimum Organization, WebSite et Article/Product selon votre activité. Utilisez le testeur de données structurées de Google pour valider.`
          : data?.jsonLdCount && data.jsonLdCount < 3
          ? `Bonne base ! Enrichissez avec FAQPage, BreadcrumbList ou Review pour maximiser votre visibilité GEO.`
          : `Excellent travail ! Vérifiez régulièrement la validité de vos schémas avec l'outil de test Google.`,
        lexiqueTerm: 'json-ld'
      };
  }
};

export function InsightEducationalPanel({ type, data }: InsightEducationalPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const content = getEducationalContent(type, data);

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg",
          "text-xs font-medium transition-all duration-200",
          "bg-primary/5 hover:bg-primary/10 text-primary",
          "border border-primary/20 hover:border-primary/30"
        )}
      >
        <span className="flex items-center gap-2">
          <GraduationCap className="h-3.5 w-3.5" />
          Comprendre cet insight
        </span>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
      
      {isOpen && (
        <div className="mt-2 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 space-y-4 animate-fade-in">
          {/* Concept */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <BookOpen className="h-3.5 w-3.5" />
              C'est quoi ?
            </div>
            <p className="text-xs text-foreground leading-relaxed pl-5">
              {content.concept}
            </p>
          </div>
          
          {/* Impact */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Target className="h-3.5 w-3.5" />
              Pourquoi c'est important ?
            </div>
            <p className="text-xs text-foreground leading-relaxed pl-5">
              {content.impact}
            </p>
          </div>
          
          {/* Action */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Lightbulb className="h-3.5 w-3.5" />
              Que faire ?
            </div>
            <p className="text-xs text-foreground leading-relaxed pl-5">
              {content.action}
            </p>
          </div>
          
          {/* Lexicon link */}
          {content.lexiqueTerm && (
            <div className="pt-2 border-t border-primary/20">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>En savoir plus :</span>
                <HelpButton term={content.lexiqueTerm} size="sm" />
                <span className="text-primary hover:underline">
                  Voir le lexique
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
