import { createFileRoute, redirect } from "@tanstack/react-router";
import ArticlePage, { ARTICLE_SEO_OVERRIDES } from "@/pages/Blog/ArticlePage";
import { getArticleBySlug } from "@/data/blogArticles";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo/pageHead";
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo/articleSchema";
import { resolveLastUpdated } from "@/lib/blog/lastUpdated";

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
};

export const Route = createFileRoute("/blog/$slug")({
  beforeLoad: ({ params }) => {
    const target = CONSOLIDATED_SLUGS[params.slug];
    if (target && target !== params.slug) {
      throw redirect({ href: `/blog/${target}`, statusCode: 301, replace: true });
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

    const { data } = await supabase
      .from("blog_articles")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

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

    return { found: false, title: null, description: null, image: null, date: null, updatedAt: null, db: null };
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
      ],
    });
  },
  component: ArticlePage,
});
