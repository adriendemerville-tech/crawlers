import { useEffect, useState } from 'react';
import { Link } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Globe, Layers } from 'lucide-react';

interface DomainRow {
  domain: string;
  citations: number;
  share: number;
}

interface TypeRow {
  content_type: string;
  citations: number;
  share: number;
}

/** Sous ce seuil, l'échantillon est trop faible pour publier un classement. */
const MIN_SAMPLE = 100;
const WINDOW_DAYS = 90;

/**
 * Observatoire des citations IA — deux sections chiffrées :
 * 1. Domaines les plus cités par les moteurs IA
 * 2. Types de contenus cités par les moteurs IA
 *
 * Source : réponses des moteurs génératifs collectées par le module GEO de
 * Crawlers (agrégation anonymisée, aucune URL ni donnée personnelle exposée).
 */
export function AiCitationsObservatory() {
  const [domains, setDomains] = useState<DomainRow[] | null>(null);
  const [types, setTypes] = useState<TypeRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, t] = await Promise.all([
        supabase.rpc('get_ai_citation_domains', { _days: WINDOW_DAYS, _limit: 20 }),
        supabase.rpc('get_ai_citation_content_types', { _days: WINDOW_DAYS }),
      ]);
      if (cancelled) return;
      setDomains((d.data as DomainRow[] | null) ?? []);
      setTypes((t.data as TypeRow[] | null) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalDomainCitations = (domains ?? []).reduce((s, r) => s + Number(r.citations), 0);
  const totalTypeCitations = (types ?? []).reduce((s, r) => s + Number(r.citations), 0);
  const thinDomains = totalDomainCitations < MIN_SAMPLE;
  const thinTypes = totalTypeCitations < MIN_SAMPLE;
  const updatedAt = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section
      className="container mx-auto max-w-6xl px-4 py-12 md:py-16"
      aria-label="Observatoire des citations des moteurs IA"
    >
      <div className="mb-8">
        <Badge variant="outline" className="mb-3">
          Mise à jour : {updatedAt} · fenêtre {WINDOW_DAYS} jours
        </Badge>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          Observatoire des citations des moteurs IA
        </h2>
        <p className="mt-3 text-muted-foreground leading-relaxed max-w-3xl">
          Quand ChatGPT, Perplexity ou Gemini répondent, ils citent des sources. Cet observatoire
          mesure lesquelles, à partir des réponses collectées par le module GEO de Crawlers sur des
          requêtes réelles du web francophone.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Domaines les plus cités ─────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                <h3 className="text-lg font-semibold">
                  Domaines les plus cités par les moteurs IA
                </h3>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (domains ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune citation collectée sur la fenêtre courante.
              </p>
            ) : (
              <>
                {thinDomains && (
                  <p className="mb-4 rounded-md border border-amber-500/40 px-3 py-2 text-xs text-muted-foreground">
                    Échantillon en constitution ({totalDomainCitations} citations relevées). Le
                    classement est indicatif et n'a pas encore de valeur statistique : il se
                    stabilise au-delà de {MIN_SAMPLE} citations.
                  </p>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 font-medium">Domaine</th>
                      <th className="py-2 font-medium text-right">Citations</th>
                      <th className="py-2 font-medium text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(domains ?? []).map((row) => (
                      <tr key={row.domain} className="border-b border-border/50">
                        <td className="py-2 text-foreground">{row.domain}</td>
                        <td className="py-2 text-right tabular-nums">{row.citations}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {row.share} %
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Types de contenus cités ──────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                <h3 className="text-lg font-semibold">
                  Types de contenus cités par les moteurs IA
                </h3>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (types ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune citation collectée sur la fenêtre courante.
              </p>
            ) : (
              <>
                {thinTypes && (
                  <p className="mb-4 rounded-md border border-amber-500/40 px-3 py-2 text-xs text-muted-foreground">
                    Échantillon en constitution ({totalTypeCitations} citations relevées).
                    Répartition indicative.
                  </p>
                )}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 font-medium">Type de contenu</th>
                      <th className="py-2 font-medium text-right">Citations</th>
                      <th className="py-2 font-medium text-right">Part</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(types ?? []).map((row) => (
                      <tr key={row.content_type} className="border-b border-border/50">
                        <td className="py-2 text-foreground">{row.content_type}</td>
                        <td className="py-2 text-right tabular-nums">{row.citations}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          {row.share} %
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <blockquote className="citable-passage mt-8 border-l-2 border-primary/60 pl-4 text-foreground">
        Les moteurs IA ne citent pas les pages les mieux classées sur Google : ils citent les pages
        qui répondent de façon vérifiable et structurée. Guides, comparatifs et forums dominent les
        citations, loin devant les pages produit.
      </blockquote>

      <div className="mt-8 rounded-lg border border-border p-5">
        <h3 className="font-semibold text-foreground mb-2">Méthodologie et portée</h3>
        <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
          <li>
            Fenêtre d'observation : {WINDOW_DAYS} jours glissants, moteurs interrogés par le module
            GEO de Crawlers (ChatGPT, Perplexity, Gemini selon disponibilité).
          </li>
          <li>
            Unité de mesure : une citation = une URL présente dans une réponse générative. Les
            domaines sont normalisés (sous-domaine « www » retiré).
          </li>
          <li>
            Classification des types de contenus : heuristique déterministe sur le chemin de l'URL
            (guide, comparatif, forum, documentation, actualité, produit).
          </li>
          <li>
            Limites : échantillon dépendant des requêtes testées par les utilisateurs de Crawlers,
            donc non représentatif de l'ensemble du web francophone. Aucune donnée personnelle ni
            URL complète n'est exposée.
          </li>
        </ul>
        <Link
          to="/generative-engine-optimization"
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-foreground/30 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-foreground"
        >
          Comprendre le référencement IA
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
