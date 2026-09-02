import { CompetitorMatrixCta } from '@/components/seo/CompetitorMatrixCta';
import { lazy, Suspense } from 'react';
import { ArrowRight, Check, Linkedin, ListOrdered, Search, ShieldAlert } from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { DirectAnswer } from '@/components/seo/DirectAnswer';
import { Link } from '@/lib/router-compat';
import adrienPhoto from '@/assets/adrien-de-volontat.webp';

const Footer = lazy(() => import('@/components/Footer').then((module) => ({ default: module.Footer })));

const CONTENT = {
  takeaways: [
    'ChatGPT ne fournit pas un tableau public des impressions ou des mentions de marque.',
    'Le suivi fiable repose sur un panel de prompts, plusieurs modèles et des mesures répétées.',
    'Les citations, le sentiment et la position de la marque doivent être suivis séparément.',
    'Un audit GEO permet ensuite de relier chaque absence de citation à une action vérifiable.',
  ],
  faqs: [
    {
      question: 'ChatGPT fournit-il les impressions de ma marque ?',
      answer:
        'Non. OpenAI ne publie pas de Search Console donnant les impressions, le taux de clic ou la part de voix d’une marque dans ChatGPT. Il faut donc mesurer la présence de la marque avec un panel de requêtes répété dans le temps.',
    },
    {
      question: 'Combien de prompts faut-il suivre ?',
      answer:
        'Un premier suivi exploitable peut commencer avec 20 à 50 prompts répartis entre découverte, comparaison et intention commerciale. Le panel doit rester stable pour comparer les évolutions, puis être enrichi séparément avec de nouveaux prompts.',
    },
    {
      question: 'Quelle différence entre une mention et une citation ?',
      answer:
        'Une mention correspond au nom de la marque dans la réponse. Une citation ajoute une source ou un lien vers une page de l’entreprise ; elle constitue donc un signal plus fort de visibilité et de citabilité.',
    },
  ],
};

const SOMMAIRE = [
  { id: 'limites', label: 'Pourquoi le suivi des mentions est différent dans ChatGPT' },
  { id: 'panel-prompts', label: 'Construire un panel de prompts représentatif' },
  { id: 'mesurer', label: 'Quelles métriques suivre en 2027 ?' },
  { id: 'automatiser', label: 'Automatiser la mesure et détecter les opportunités' },
  { id: 'agir', label: 'Transformer une absence de mention en action GEO' },
  { id: 'faq', label: 'Questions fréquentes' },
];

function ArticleCta({ bottom = false }: { bottom?: boolean }) {
  return (
    <section
      className={`border-y border-primary/30 py-6 ${bottom ? 'mt-12' : 'mb-10'}`}
      aria-label="Accéder à l’audit GEO"
    >
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-gold">
            Mesurez votre visibilité IA
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Identifiez les pages et signaux qui favorisent les citations de votre marque dans les moteurs génératifs.
          </p>
        </div>
        <Button asChild variant="outline" size="lg" className="shrink-0 bg-transparent hover:bg-transparent">
          <Link to="/marina">
            Lancer l’audit GEO <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

function AuthorBox() {
  return (
    <aside className="mt-14 border-t border-border pt-8" aria-label="À propos de l’auteur">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Link to="/auteur/adrien-de-volontat" className="shrink-0" aria-label="Voir le profil d’Adrien de Volontat">
          <img
            src={adrienPhoto}
            alt="Adrien de Volontat, fondateur de Crawlers.fr"
            width={88}
            height={88}
            className="h-[88px] w-[88px] rounded-full object-cover ring-2 ring-primary/30"
            loading="lazy"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-gold">Auteur</p>
          <h2 className="text-xl font-bold text-foreground">Adrien de Volontat</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Fondateur de Crawlers.fr et spécialiste SEO/GEO, Adrien conçoit des méthodes pour mesurer la visibilité des marques dans Google et les moteurs génératifs.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="bg-transparent hover:bg-transparent">
              <a href="https://www.linkedin.com/in/adrien-de-volontat/" target="_blank" rel="noopener noreferrer me">
                <Linkedin aria-hidden="true" /> LinkedIn
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="bg-transparent hover:bg-transparent">
              <Link to="/auteur/adrien-de-volontat">
                Profil auteur <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function TrackChatGPTMentions2027() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 pb-16 pt-28">
        <article>
          <header className="mb-8">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-brand-gold">
              Guide GEO · Mis à jour en 2027
            </p>
            <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              Comment suivre les mentions de votre marque sur ChatGPT en 2027
            </h1>
            <p className="mt-5 max-w-3xl border-l-2 border-primary pl-4 text-lg leading-relaxed text-muted-foreground">
              ChatGPT ne propose pas de tableau de bord public comparable à Google Search Console. Pour savoir si votre marque est connue, recommandée et citée, il faut mettre en place un protocole de prompts stable, répété et comparable entre les principaux modèles IA.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Par Adrien de Volontat · 8 min de lecture</p>
          </header>

          <ArticleCta />

          <DirectAnswer
            path="/guides/suivre-mentions-marque-chatgpt-2027"
            question="Comment suivre les mentions de sa marque dans ChatGPT en 2027 ?"
            answer="Il faut interroger régulièrement ChatGPT avec un panel de prompts représentatifs, enregistrer la présence de la marque, sa position dans la réponse, les citations et le sentiment, puis comparer ces résultats dans le temps. Comme OpenAI ne fournit pas d’impressions publiques par marque, ce suivi par panel est un indicateur de visibilité et non un CTR exact."
            facts={[
              { label: 'Qui', value: 'Équipes SEO, marketing, agences et éditeurs de marque' },
              { label: 'Quoi', value: 'Mentions, citations, recommandations et sentiment' },
              { label: 'Quand', value: 'Chaque semaine pour un suivi opérationnel' },
              { label: 'Combien', value: '20 à 50 prompts pour un premier panel' },
            ]}
            className="mb-10"
          />

          <nav className="mb-12 border-y border-border py-5" aria-label="Sommaire de l’article">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <ListOrdered className="h-4 w-4 text-brand-gold" aria-hidden="true" />
              Sommaire
            </h2>
            <ol className="grid gap-2 text-sm sm:grid-cols-2">
              {SOMMAIRE.map((item, index) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="flex gap-2 text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline">
                    <span className="tabular-nums text-primary">{index + 1}.</span>
                    <span>{item.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <section className="mb-12 border-l-2 border-brand-gold pl-5" aria-labelledby="a-retenir">
            <h2 id="a-retenir" className="mb-4 text-2xl font-bold">À retenir</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {CONTENT.takeaways.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="limites" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold">Pourquoi le suivi des mentions est différent dans ChatGPT</h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">
              Dans la recherche classique, une impression correspond à l’affichage d’un résultat et une position permet de comparer les concurrents. ChatGPT fonctionne autrement : la réponse est générée à la demande, varie selon le prompt, le contexte, la date, le modèle et parfois la localisation.
            </p>
            <p className="citable-passage border-l-2 border-primary/60 pl-4 leading-relaxed text-foreground">
              En 2027, il n’existe toujours pas de Search Console publique donnant les impressions, le CTR ou la part de voix d’une marque dans ChatGPT. Le suivi des mentions doit donc reposer sur des tests contrôlés et répétés, complétés par les clics référents visibles dans les outils d’analytics.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="border border-border p-5">
                <ShieldAlert className="mb-3 h-5 w-5 text-brand-gold" aria-hidden="true" />
                <h3 className="mb-2 font-semibold">Ce qui est mesurable</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">La réponse obtenue, la présence de la marque, sa position, le ton, les sources citées et les variations d’un test à l’autre.</p>
              </div>
              <div className="border border-border p-5">
                <Search className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="mb-2 font-semibold">Ce qui ne l’est pas directement</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">Le nombre total de fois où toutes les personnes ont vu la marque dans ChatGPT et un CTR d’impression natif par modèle.</p>
              </div>
            </div>
          </section>

          <section id="panel-prompts" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold">Construire un panel de prompts représentatif</h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">Un bon panel ne demande pas uniquement « quelle est la meilleure marque ? ». Il reproduit les formulations utilisées par vos prospects à chaque étape de leur décision, sans forcer ChatGPT à citer votre entreprise.</p>
            <div className="overflow-x-auto border border-border">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-3 font-semibold">Intention</th><th className="px-4 py-3 font-semibold">Exemple de question</th><th className="px-4 py-3 font-semibold">Signal à relever</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="px-4 py-3 font-medium">Découverte</td><td className="px-4 py-3 text-muted-foreground">Quelles entreprises répondent à ce besoin en France ?</td><td className="px-4 py-3 text-muted-foreground">Présence et catégorie attribuée</td></tr>
                  <tr><td className="px-4 py-3 font-medium">Comparaison</td><td className="px-4 py-3 text-muted-foreground">Quelles solutions comparer pour ce projet ?</td><td className="px-4 py-3 text-muted-foreground">Position et concurrents associés</td></tr>
                  <tr><td className="px-4 py-3 font-medium">Achat</td><td className="px-4 py-3 text-muted-foreground">Quelle solution choisir pour ce cas précis ?</td><td className="px-4 py-3 text-muted-foreground">Recommandation et justification</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 leading-relaxed text-muted-foreground">Conservez une version gelée du panel principal. Vous pourrez ajouter un panel exploratoire, mais mélanger les deux fausse la comparaison entre deux semaines ou deux mois.</p>
          </section>

          <section id="mesurer" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold">Quelles métriques suivre en 2027 ?</h2>
            <p className="mb-5 leading-relaxed text-muted-foreground">La simple présence du nom ne suffit pas. Une marque peut être citée comme exemple, mentionnée négativement ou recommandée devant tous ses concurrents. Le tableau de suivi doit séparer au moins quatre dimensions.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['Taux de mention', 'Part des réponses du panel dans lesquelles le nom apparaît.'],
                ['Part de citation', 'Part des réponses qui associent la marque à une source ou une page identifiable.'],
                ['Position moyenne', 'Rang de la marque parmi les entreprises proposées dans la réponse.'],
                ['Sentiment et recommandation', 'Ton de la réponse et capacité de la marque à être recommandée pour le cas demandé.'],
              ].map(([title, text]) => (
                <div key={title} className="border border-border p-5">
                  <h3 className="mb-2 font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
            <p className="citable-passage mt-6 border-l-2 border-primary/60 pl-4 leading-relaxed text-foreground">Une mention mesure la reconnaissance, une citation mesure la citabilité et une recommandation mesure la capacité de la marque à entrer dans le choix final. Les trois indicateurs doivent être lus ensemble pour éviter de confondre notoriété et visibilité commerciale.</p>
          </section>

          <section id="automatiser" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold">Automatiser la mesure et détecter les opportunités</h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">Un test manuel est utile pour comprendre le fonctionnement du modèle, mais il ne permet pas de repérer une évolution hebdomadaire. L’automatisation lance les mêmes prompts sur plusieurs modèles, conserve la réponse brute et calcule les variations par rapport à une référence.</p>
            <ol className="grid gap-3">
              {[
                'Définir le panel, les modèles interrogés et la fréquence de mesure.',
                'Conserver le prompt exact, la date, le modèle et la réponse complète.',
                'Extraire les mentions, les citations, le sentiment et les concurrents présents.',
                'Déclencher une alerte seulement au-delà d’un seuil stable et documenté.',
                'Relier l’alerte à une page, une entité ou un contenu à améliorer.',
              ].map((item, index) => (
                <li key={item} className="flex gap-3 border-b border-border pb-3 text-sm leading-relaxed text-muted-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-primary text-xs font-semibold text-primary">{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>

          <section id="agir" className="mb-12 scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold">Transformer une absence de mention en action GEO</h2>
            <p className="mb-4 leading-relaxed text-muted-foreground">Une absence de marque dans ChatGPT n’est pas une preuve qu’un contenu est mauvais. Elle peut révéler une entité mal définie, une page difficile à citer, un manque de preuves tierces ou un décalage entre le contenu et l’intention de la question.</p>
            <div className="border-l-2 border-brand-gold pl-5">
              <h3 className="mb-2 text-lg font-semibold">Le bon diagnostic commence par la cause</h3>
              <p className="citable-passage leading-relaxed text-foreground">Avant de produire davantage de contenu, comparez la réponse du modèle avec les faits vérifiables de la page : activité, zone couverte, expertise, preuves, auteurs, données structurées et liens. Cette lecture permet de corriger le signal réellement absent au lieu de multiplier les textes génériques.</p>
            </div>
            <p className="mt-5 leading-relaxed text-muted-foreground">Le suivi doit enfin être relié aux données disponibles côté analytics. Les sessions provenant de ChatGPT, Copilot, Gemini ou Perplexity peuvent servir de proxy de clics, mais elles ne remplacent pas les impressions invisibles dans les plateformes IA.</p>
          </section>

          <section id="faq" className="mb-4 scroll-mt-24">
            <h2 className="mb-6 text-2xl font-bold">Questions fréquentes</h2>
            <div className="divide-y divide-border border-y border-border">
              {CONTENT.faqs.map((faq) => (
                <details key={faq.question} className="group py-4">
                  <summary className="cursor-pointer list-none pr-6 font-semibold marker:hidden">{faq.question}</summary>
                  <p className="pt-3 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <CompetitorMatrixCta intro="Les mentions ChatGPT ne se lisent pas seules : comparez votre présence à celle de vos concurrents sur les 20 requêtes clés de votre marché, dans la SERP et dans les réponses des IA." />
          <ArticleCta bottom />
          <AuthorBox />

        </article>
      </main>
      <Suspense fallback={null}><Footer /></Suspense>
    </div>
  );
}
