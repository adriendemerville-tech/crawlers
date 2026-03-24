import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { CrawlersLogo } from '@/components/Support/CrawlersLogo';
import { 
  MessageCircle, Network, ArrowRight, Crown, Sparkles, 
  Search, BarChart3, Globe, Brain, HelpCircle, ScrollText,
  Compass, Target, Zap, Shield, Eye
} from 'lucide-react';

/** Gold-themed Crawlers logo (square, matching Stratège Cocoon style) */
function GoldCrawlersLogo({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size} className={className}>
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#f5c842' }} />
          <stop offset="50%" style={{ stopColor: '#d4a853' }} />
          <stop offset="100%" style={{ stopColor: '#b8860b' }} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="10" ry="10" fill="url(#goldGrad)" />
      <g transform="translate(8.4, 8.4) scale(1.3)" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 8V4H8" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M9 13v2" />
        <path d="M15 13v2" />
      </g>
    </svg>
  );
}

/** Violet round Crawlers logo for Félix */
function VioletRoundCrawlersLogo({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width={size} height={size} className={className}>
      <defs>
        <linearGradient id="violetRoundGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#a855f7' }} />
          <stop offset="50%" style={{ stopColor: '#7c3aed' }} />
          <stop offset="100%" style={{ stopColor: '#6d28d9' }} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="url(#violetRoundGrad)" />
      <g transform="translate(8.4, 8.4) scale(1.3)" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 8V4H8" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M9 13v2" />
        <path d="M15 13v2" />
      </g>
    </svg>
  );
}

const AIAgentsSection = memo(() => {
  const { language } = useLanguage();

  return (
    <section className="relative overflow-hidden border-y border-border py-16 sm:py-24">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950/5 via-background to-emerald-950/5 dark:from-violet-950/20 dark:via-background dark:to-emerald-950/20" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.04),transparent_70%)]" />

      <div className="relative mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/5 text-primary px-3 py-1 text-xs font-semibold">
            <Brain className="w-3.5 h-3.5 mr-1.5" />
            {language === 'fr' ? 'Intelligence Artificielle Embarquée' : language === 'es' ? 'Inteligencia Artificial Integrada' : 'Built-in Artificial Intelligence'}
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-display">
            {language === 'fr' ? 'Deux agents IA, deux missions' : language === 'es' ? 'Dos agentes IA, dos misiones' : 'Two AI agents, two missions'}
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
            {language === 'fr' 
              ? 'Crawlers.fr intègre deux assistants intelligents pour vous accompagner à chaque étape : comprendre vos audits et piloter votre stratégie SEO.'
              : language === 'es'
              ? 'Crawlers.fr integra dos asistentes inteligentes para acompañarle en cada paso: comprender sus auditorías y pilotar su estrategia SEO.'
              : 'Crawlers.fr integrates two intelligent assistants to guide you at every step: understand your audits and pilot your SEO strategy.'}
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid gap-8 md:grid-cols-2">
          
          {/* ─── Félix Card ─── */}
          <div className="group relative rounded-2xl border-2 border-violet-500/40 bg-card/80 backdrop-blur-sm p-8 transition-all duration-300 hover:border-violet-500/70 hover:shadow-lg hover:shadow-primary/5">
            {/* Icon */}
            <div className="mb-6 flex items-center gap-4">
              <VioletRoundCrawlersLogo size={56} />
              <div>
                <h3 className="text-2xl font-bold text-foreground font-display">Félix</h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'fr' ? 'Assistant personnel' : language === 'es' ? 'Asistente personal' : 'Personal assistant'}
                </p>
              </div>
              <Badge className="ml-auto bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 text-[11px]">
                {language === 'fr' ? 'Gratuit' : language === 'es' ? 'Gratis' : 'Free'}
              </Badge>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              {language === 'fr' 
                ? 'Félix est votre copilote permanent. Il voit ce que vous voyez à l\'écran, explique chaque score, chaque recommandation, et vous guide pas à pas dans la compréhension de vos audits techniques et stratégiques.'
                : language === 'es'
                ? 'Félix es su copiloto permanente. Ve lo que usted ve en pantalla, explica cada puntuación, cada recomendación, y le guía paso a paso en la comprensión de sus auditorías.'
                : 'Félix is your permanent copilot. He sees what you see on screen, explains every score and recommendation, and guides you step by step through your audits.'}
            </p>

            {/* Features */}
            <div className="space-y-3 mb-8">
              {[
                { 
                  icon: Eye, 
                  text: language === 'fr' ? 'Lecture contextuelle de l\'écran en temps réel' : 'Real-time contextual screen reading',
                  color: 'text-violet-500'
                },
                { 
                  icon: HelpCircle, 
                  text: language === 'fr' ? 'Explication des scores SEO, GEO et E-E-A-T' : 'SEO, GEO & E-E-A-T score explanations',
                  color: 'text-blue-500'
                },
                { 
                  icon: Search, 
                  text: language === 'fr' ? 'Recherche Google en temps réel (SERP, positions, avis)' : 'Real-time Google search (SERP, rankings, reviews)',
                  color: 'text-amber-500'
                },
                { 
                  icon: ScrollText, 
                  text: language === 'fr' ? 'Guide interactif : vous demande de scroller pour analyser plus' : 'Interactive guide: asks you to scroll for deeper analysis',
                  color: 'text-emerald-500'
                },
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <feat.icon className={`h-4 w-4 mt-0.5 shrink-0 ${feat.color}`} />
                  <span className="text-sm text-foreground/80">{feat.text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <p className="text-xs text-muted-foreground italic">
              {language === 'fr' 
                ? 'Disponible sur toutes les pages d\'audit — cliquez sur la bulle violette en bas à droite.'
                : language === 'es'
                ? 'Disponible en todas las páginas de auditoría — haga clic en la burbuja violeta en la parte inferior derecha.'
                : 'Available on every audit page — click the purple bubble in the bottom-right corner.'}
            </p>
          </div>

          {/* ─── Stratège Cocoon Card ─── */}
          <div className="group relative rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 transition-all duration-300 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
            {/* Pro badge ribbon */}
            <div className="absolute -top-px -right-px">
              <div className="rounded-bl-xl rounded-tr-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                Pro Agency
              </div>
            </div>

            {/* Icon */}
            <div className="mb-6 flex items-center gap-4">
              <GoldCrawlersLogo size={56} />
              <div>
                <h3 className="text-2xl font-bold text-foreground font-display">Stratège Cocoon</h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'fr' ? 'Consultant SEO senior' : language === 'es' ? 'Consultor SEO senior' : 'Senior SEO consultant'}
                </p>
              </div>
            </div>

            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              {language === 'fr'
                ? 'Le Stratège est un consultant IA senior qui connaît votre site. Il analyse votre cocon sémantique, prescrit des actions concrètes (maillage, contenus, arborescence) et conserve une mémoire de toutes vos conversations pour affiner ses recommandations au fil du temps.'
                : language === 'es'
                ? 'El Estratega es un consultor IA senior que conoce su sitio. Analiza su cocoon semántico, prescribe acciones concretas (enlaces, contenidos, arborescencia) y conserva una memoria de todas sus conversaciones.'
                : 'The Strategist is a senior AI consultant who knows your site. It analyzes your semantic cocoon, prescribes concrete actions (linking, content, structure) and retains memory of all conversations to refine recommendations over time.'}
            </p>

            {/* Features */}
            <div className="space-y-3 mb-8">
              {[
                { 
                   icon: Compass, 
                   text: language === 'fr' ? 'Diagnostic du maillage interne et pages orphelines' : 'Internal linking diagnostics & orphan pages',
                   color: 'text-amber-500'
                 },
                 { 
                   icon: Target, 
                   text: language === 'fr' ? 'Prescriptions concrètes : contenus, liens, architecture' : 'Concrete prescriptions: content, links, architecture',
                   color: 'text-amber-500'
                 },
                { 
                  icon: Brain, 
                  text: language === 'fr' ? 'Mémoire persistante entre sessions — s\'améliore avec le temps' : 'Persistent memory between sessions — improves over time',
                  color: 'text-violet-500'
                },
                { 
                  icon: BarChart3, 
                  text: language === 'fr' ? 'Suivi d\'impact T+30 / T+60 / T+90 via GSC & GA4' : 'Impact tracking at T+30/60/90 via GSC & GA4',
                  color: 'text-blue-500'
                },
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <feat.icon className={`h-4 w-4 mt-0.5 shrink-0 ${feat.color}`} />
                  <span className="text-sm text-foreground/80">{feat.text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link to="/cocoon">
              <Button 
                 variant="outline" 
                 size="sm"
                 className="gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50"
               >
                <Network className="h-4 w-4" />
                {language === 'fr' ? 'Découvrir le Cocoon' : language === 'es' ? 'Descubrir el Cocoon' : 'Discover Cocoon'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
});
AIAgentsSection.displayName = 'AIAgentsSection';

export { AIAgentsSection };
