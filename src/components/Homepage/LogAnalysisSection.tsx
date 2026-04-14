import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Terminal, ArrowRight, Search, Bot, AlertTriangle, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const features = [
  { icon: Search, label: 'Budget crawl', desc: 'Visualisez la répartition du crawl Google page par page' },
  { icon: Bot, label: '40+ bots détectés', desc: 'Googlebot, GPTBot, ClaudeBot, Bingbot et plus' },
  { icon: AlertTriangle, label: 'Pages orphelines', desc: 'Identifiez les pages jamais visitées par les robots' },
  { icon: Activity, label: 'Monitoring continu', desc: 'Suivi en temps réel via connecteur Cloudflare' },
];

export const LogAnalysisSection = memo(function LogAnalysisSection() {
  const { language } = useLanguage();

  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/3 via-transparent to-primary/3" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Left — text */}
          <div className="flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              <Terminal className="h-3.5 w-3.5" />
              {language === 'fr' ? 'Analyse de Logs' : language === 'es' ? 'Análisis de Logs' : 'Log Analysis'}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              {language === 'fr'
                ? 'Vos logs serveur révèlent ce que la Search Console cache'
                : language === 'es'
                ? 'Sus logs de servidor revelan lo que Search Console oculta'
                : 'Your server logs reveal what Search Console hides'}
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-xl">
              {language === 'fr'
                ? 'Chaque requête HTTP est une donnée SEO brute. L\'analyse de logs montre exactement comment Googlebot et les bots IA explorent votre site — pages orphelines, budget crawl gaspillé, erreurs invisibles.'
                : language === 'es'
                ? 'Cada petición HTTP es un dato SEO bruto. El análisis de logs muestra exactamente cómo Googlebot y los bots IA exploran su sitio.'
                : 'Every HTTP request is raw SEO data. Log analysis shows exactly how Googlebot and AI bots crawl your site — orphan pages, wasted crawl budget, invisible errors.'}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/analyse-logs">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white border-0 shadow-lg">
                  <Terminal className="h-4 w-4" />
                  {language === 'fr' ? 'En savoir plus' : language === 'es' ? 'Saber más' : 'Learn more'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pro-agency">
                <Button variant="outline" size="lg" className="gap-2">
                  {language === 'fr' ? 'Inclus dans Pro Agency' : language === 'es' ? 'Incluido en Pro Agency' : 'Included in Pro Agency'}
                </Button>
              </Link>
            </div>
          </div>

          {/* Right — 4 feature cards */}
          <div className="grid grid-cols-2 gap-4 w-full lg:w-[420px] shrink-0">
            {features.map((f) => (
              <div key={f.label} className="rounded-xl border border-border/60 bg-card/80 backdrop-blur p-5 space-y-2 hover:shadow-lg hover:border-cyan-500/30 transition-all">
                <f.icon className="h-6 w-6 text-cyan-500" />
                <p className="text-sm font-semibold text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});
