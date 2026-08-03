import { createFileRoute } from "@tanstack/react-router";
import GuideLandingPage from "@/pages/GuideLandingPage";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo/pageHead";
import { parseGuideFromDb } from "@/lib/guides/parseGuide";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/lib/seo/articleSchema";
import type { GuideData } from "@/components/Guide/GuideTemplate";

export const Route = createFileRoute("/guide/$slug")({
  loader: async ({ params }): Promise<{ guide: GuideData | null }> => {
    const { data } = await supabase
      .from("seo_page_drafts" as never)
      .select("*")
      .eq("slug", params.slug)
      .eq("status", "published")
      .eq("page_type", "guide")
      .maybeSingle();

    if (!data) return { guide: null };
    return { guide: parseGuideFromDb(data) };
  },
  head: ({ params, loaderData }) => {
    const path = `/guide/${params.slug}`;
    const guide = loaderData?.guide;

    if (!guide) {
      return pageHead({
        title: "Guide introuvable | Crawlers.fr",
        description: "Ce guide SEO & GEO de Crawlers.fr n'est pas disponible.",
        path,
        noIndex: true,
      });
    }

    const description =
      guide.metaDescription ||
      `Guide SEO & GEO Crawlers.fr : ${guide.title}. Méthode, checklist et actions concrètes.`;

    return pageHead({
      title: guide.metaTitle || `${guide.title} | Crawlers.fr`,
      description,
      path,
      ogType: "article",
      ...(guide.targetKeyword ? { keywords: guide.targetKeyword } : {}),
      extraMeta: [
        ...(guide.publishedAt
          ? [{ property: "article:published_time", content: guide.publishedAt }]
          : []),
        ...(guide.updatedAt
          ? [{ property: "article:modified_time", content: guide.updatedAt }]
          : []),
        { property: "article:author", content: "Adrien de Volontat" },
      ],
      jsonLd: [
        buildArticleJsonLd({
          title: guide.title,
          description,
          path,
          datePublished: guide.publishedAt ?? null,
          dateModified: guide.updatedAt ?? null,
          section: "Guides SEO & GEO",
          ...(guide.targetKeyword ? { keywords: guide.targetKeyword } : {}),
        }),
        buildBreadcrumbJsonLd([
          { name: "Accueil", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: guide.title, path },
        ]),
        ...(guide.faqs?.length ? [buildFaqJsonLd(guide.faqs)] : []),
      ],
    });
  },
  component: GuideLandingPage,
});
