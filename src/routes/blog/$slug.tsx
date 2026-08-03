import { createFileRoute } from "@tanstack/react-router";
import ArticlePage, { ARTICLE_SEO_OVERRIDES } from "@/pages/Blog/ArticlePage";
import { getArticleBySlug } from "@/data/blogArticles";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo/pageHead";
import { buildArticleJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo/articleSchema";

export interface BlogArticleLoaderData {
  found: boolean;
  title: string | null;
  description: string | null;
  image: string | null;
  date: string | null;
  /** Full DB row when the article lives in blog_articles (SSR body content) */
  db: Record<string, unknown> | null;
}

export const Route = createFileRoute("/blog/$slug")({
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
        db: data as unknown as Record<string, unknown>,
      };
    }

    return { found: false, title: null, description: null, image: null, date: null, db: null };
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
              { property: "article:modified_time", content: loaderData.date },
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
