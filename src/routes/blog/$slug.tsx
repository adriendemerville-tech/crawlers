import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import ArticlePage from "@/pages/Blog/ArticlePage";
import { ARTICLE_SEO_OVERRIDES } from "@/pages/Blog/articleSeoOverrides";
import { getArticleBySlug } from "@/data/blogArticles";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo/pageHead";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildDefinedTermJsonLd,
} from "@/lib/seo/articleSchema";
import { resolveLastUpdated } from "@/lib/blog/lastUpdated";

/**
 * Articles de définition : on ajoute un DefinedTerm rattaché au lexique pour
 * que le terme soit identifié comme entité définie (SEO + citations IA).
 */
const DEFINITION_ARTICLES: Record<string, { term: string; definition: string }> = {
  "crawler-definition-seo-geo": {
    term: "Crawler",
    definition:
      "Un crawler est un programme automatisé, aussi appelé robot d'indexation ou araignée du web, qui parcourt les pages d'un site en suivant les liens pour en collecter le contenu. Les crawlers SEO (Googlebot, Bingbot) alimentent les moteurs de recherche ; les crawlers IA (GPTBot, ClaudeBot, Google-Extended) alimentent les réponses des moteurs génératifs.",
  },
};

export interface BlogArticleLoaderData {
  found: boolean;
  title: string | null;
  description: string | null;
  image: string | null;
  date: string | null;
  /** Jour ISO (YYYY-MM-DD) uniquement si le contenu a réellement été révisé */
  updatedAt: string | null;
  /** Full DB row when the article lives in blog_articles (SSR body content) */
  db: Record<string, unknown> | null;
}

/**
 * Consolidation éditoriale : anciens articles quasi dupliqués fusionnés dans un
 * pilier unique. On conserve les URLs historiques en 301 pour ne perdre aucun
 * signal et éviter les 404 côté crawlers.
 */
const CONSOLIDATED_SLUGS: Record<string, string> = {
  "front-loading-semantique-pourquoi-placer-votre-mot-cle-en-tete-de-title-est-vita":
    "front-loading-title-mot-cle-premier-mot",
  "front-loading-seo-maximiser-le-poids-semantique-du-premier-mot-de-votre-balise-t":
    "front-loading-title-mot-cle-premier-mot",
  "optimiser-la-balise-title-pour-le-double-impact-algorithmes-google-et-moteurs-ia":
    "front-loading-title-mot-cle-premier-mot",
  "optimiser-sa-balise-title-l-impact-strategique-du-premier-mot-en-2026":
    "front-loading-title-mot-cle-premier-mot",
  "front-loading-strategique-positionner-votre-mot-cle-en-debut-de-title-pour-domin":
    "front-loading-title-mot-cle-premier-mot",
  "la-regle-du-premier-mot-optimiser-l-emplacement-de-ses-mots-cles-dans-le-title-p":
    "front-loading-title-mot-cle-premier-mot",
  "la-methode-du-front-loading-pourquoi-placer-votre-mot-cle-des-le-premier-mot-de-":
    "front-loading-title-mot-cle-premier-mot",
  "le-dilemme-du-premier-mot-optimiser-la-position-des-mots-cles-dans-la-balise-tit":
    "front-loading-title-mot-cle-premier-mot",
  // Trio « mise aux normes IA » : pilier = le guide stratégique (le plus complet)
  "mise-aux-normes-ia-positionner-votre-offre-d-accompagnement-au-c-ur-de-la-strate":
    "la-mise-aux-normes-ia-le-guide-strategique-pour-vendre-cette-nouvelle-offre-aux-",
  "mission-mise-aux-normes-ia":
    "la-mise-aux-normes-ia-le-guide-strategique-pour-vendre-cette-nouvelle-offre-aux-",
  // Doublon d'intention « seo vs geo » : pilier = comprendre-geo-vs-seo
  "tableau-comparatif-seo-geo-2026": "comprendre-geo-vs-seo",
  // Article mince qui cannibalisait la page outil /audit-seo-gratuit et le comparatif
  "audit-seo-gratuit-vs-semrush": "/comparatif-crawlers-semrush",
};

export const Route = createFileRoute("/blog/$slug")({
  beforeLoad: ({ params }) => {
    const target = CONSOLIDATED_SLUGS[params.slug];
    if (target && target !== params.slug) {
      const href = target.startsWith("/") ? target : `/blog/${target}`;
      throw redirect({ href, statusCode: 301, replace: true });
    }
  },

  loader: async ({ params }): Promise<BlogArticleLoaderData> => {
    const slug = params.slug;
    const staticArticle = getArticleBySlug(slug);
    const override = ARTICLE_SEO_OVERRIDES[slug];

    // Static articles carry their SEO + JSX body in the bundle: no fetch needed.
    if (staticArticle) {
      return {
        found: true,
        title: override?.title ?? `${staticArticle.title.fr} | Crawlers.fr`,
        description: override?.description ?? staticArticle.description.fr,
        image: staticArticle.heroImage?.startsWith("https://") ? staticArticle.heroImage : null,
        date: staticArticle.date ?? null,
        updatedAt: null,
        db: null,
      };
    }

    // Un backend indisponible ne doit pas suspendre le SSR pendant plusieurs
    // dizaines de secondes sur un slug inconnu : on borne cette lecture.
    let data: {
      title: string;
      excerpt: string | null;
      image_url: string | null;
      published_at: string | null;
      created_at: string;
      updated_at?: string | null;
    } | null = null;
    try {
      const result = await supabase
        .from("blog_articles")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .abortSignal(AbortSignal.timeout(3000))
        .maybeSingle();
      data = result.data;
    } catch (error) {
      console.error("blog article lookup timed out or failed", error);
    }

    if (data) {
      return {
        found: true,
        title: override?.title ?? `${data.title} | Crawlers.fr`,
        description: override?.description ?? data.excerpt ?? data.title,
        image: data.image_url ?? null,
        date: data.published_at ?? data.created_at ?? null,
        updatedAt: resolveLastUpdated(
          data.published_at ?? data.created_at ?? null,
          (data as { updated_at?: string | null }).updated_at ?? null,
        ),
        db: data as unknown as Record<string, unknown>,
      };
    }

    // Slug inconnu : vrai 404 côté serveur. Sans ça le composant rendait un
    // <Navigate> pendant le SSR → réponse 200 après ~45 s (soft 404 + TTFB).
    throw notFound();

  },
  head: ({ params, loaderData }) => {
    const path = `/blog/${params.slug}`;
    if (!loaderData?.found || !loaderData.title) {
      return pageHead({
        title: "Article introuvable | Crawlers.fr",
        description: "Cet article du blog Crawlers.fr n'est pas disponible.",
        path,
        noIndex: true,
      });
    }
    const image = loaderData.image?.startsWith("https://") ? loaderData.image : null;
    return pageHead({
      title: loaderData.title,
      description: loaderData.description!,
      path,
      ogType: "article",
      ...(image ? { image } : {}),
      extraMeta: [
        ...(loaderData.date
          ? [
              { property: "article:published_time", content: loaderData.date },
              {
                property: "article:modified_time",
                content: loaderData.updatedAt ?? loaderData.date,
              },
            ]
          : []),
        { property: "article:author", content: "Adrien de Volontat" },
        { property: "article:section", content: "SEO & GEO" },
      ],
      jsonLd: [
        buildArticleJsonLd({
          title: loaderData.title.replace(/\s*\|\s*Crawlers\.fr$/i, ""),
          description: loaderData.description!,
          path,
          image,
          datePublished: loaderData.date,
          dateModified: loaderData.updatedAt,
        }),
        buildBreadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: loaderData.title.replace(/\s*\|\s*Crawlers\.fr$/i, ""), path },
        ]),
        ...(DEFINITION_ARTICLES[params.slug]
          ? [
              buildDefinedTermJsonLd({
                term: DEFINITION_ARTICLES[params.slug].term,
                definition: DEFINITION_ARTICLES[params.slug].definition,
                path,
              }),
            ]
          : []),
      ],
    });
  },
  component: ArticlePage,
});
