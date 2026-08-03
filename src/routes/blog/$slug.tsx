import { createFileRoute } from "@tanstack/react-router";
import ArticlePage, { ARTICLE_SEO_OVERRIDES } from "@/pages/Blog/ArticlePage";
import { getArticleBySlug } from "@/data/blogArticles";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const slug = params.slug;
    const override = ARTICLE_SEO_OVERRIDES[slug];
    if (override) {
      return { title: override.title, description: override.description, image: null as string | null };
    }
    const staticArticle = getArticleBySlug(slug);
    if (staticArticle) {
      return {
        title: `${staticArticle.title.fr} | Crawlers.fr`,
        description: staticArticle.description.fr,
        image: null as string | null,
      };
    }
    const { data } = await supabase
      .from("blog_articles")
      .select("title, excerpt, image_url")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (data) {
      return {
        title: `${data.title} | Crawlers.fr`,
        description: data.excerpt || data.title,
        image: data.image_url,
      };
    }
    return { title: null, description: null, image: null as string | null };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData?.title) {
      return pageHead({
        title: "Article introuvable | Crawlers.fr",
        description: "Cet article du blog Crawlers.fr n'est pas disponible.",
        path: `/blog/${params.slug}`,
        noIndex: true,
      });
    }
    return pageHead({
      title: loaderData.title,
      description: loaderData.description!,
      path: `/blog/${params.slug}`,
      ogType: "article",
      ...(loaderData.image?.startsWith("https://") ? { image: loaderData.image } : {}),
    });
  },
  component: ArticlePage,
});
