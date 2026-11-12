import { createFileRoute, notFound } from "@tanstack/react-router";
import GuideLandingPage from "@/pages/GuideLandingPage";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo/pageHead";
import { parseGuideFromDb } from "@/lib/guides/parseGuide";
import { getBuiltinGuideRow, listBuiltinGuideEntries } from "@/data/professionGuides";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/lib/seo/articleSchema";
import type { GuideData } from "@/components/Guide/GuideTemplate";
import { resolveArticleDates } from "@/lib/blog/lastUpdated";

export interface SiblingGuide {
  slug: string;
  title: string;
}

export const Route = createFileRoute("/guide/$slug")({
  // Maillage croisé : la liste des autres guides métiers est chargée côté
  // serveur pour figurer dans le HTML initial (crawlers SEO et IA).
  loader: async ({
    params,
  }): Promise<{ guide: GuideData; siblings: SiblingGuide[] }> => {
    // La base reste prioritaire (guide publié dans l'admin). Si elle ne
    // répond pas, les quatre guides métier du dépôt sont servis quand même.
    // Un slug inconnu lève notFound() : statut 404, pas une redirection vers /404.
    let data: unknown = null;
    let others: SiblingGuide[] | null = null;
    try {
      const [{ data: row }, { data: rest }] = await Promise.all([
        supabase
          .from("seo_page_drafts" as never)
          .select("*")
          .eq("slug", params.slug)
          .eq("status", "published")
          .eq("page_type", "guide")
          .abortSignal(AbortSignal.timeout(3000))
          .maybeSingle(),
        supabase
          .from("seo_page_drafts" as never)
          .select("slug, title")
          .eq("status", "published")
          .eq("page_type", "guide")
          .neq("slug", params.slug)
          .abortSignal(AbortSignal.timeout(3000))
          .order("slug", { ascending: true }),
      ]);
      data = row;
      others = (rest as unknown as SiblingGuide[]) ?? null;
    } catch (error) {
      console.error("guide lookup timed out or failed", error);
    }

    const source = data ?? getBuiltinGuideRow(params.slug);
    if (!source) throw notFound();

    const siblings = new Map<string, SiblingGuide>();
    for (const guide of others ?? []) {
      if (guide.slug && guide.title && guide.slug !== params.slug) {
        siblings.set(guide.slug, guide);
      }
    }
    for (const guide of listBuiltinGuideEntries()) {
      if (guide.slug !== params.slug && !siblings.has(guide.slug)) {
        siblings.set(guide.slug, { slug: guide.slug, title: guide.title });
      }
    }

    return {
      guide: parseGuideFromDb(source),
      siblings: [...siblings.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
    };
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

    const dates = resolveArticleDates(guide.publishedAt, guide.updatedAt);

    return pageHead({
      title: guide.metaTitle || `${guide.title} | Crawlers.fr`,
      description,
      path,
      ogType: "article",
      ...(guide.targetKeyword ? { keywords: guide.targetKeyword } : {}),
      extraMeta: [
        ...(dates.datePublished
          ? [{ property: "article:published_time", content: dates.datePublished }]
          : []),
        ...(dates.dateModified
          ? [{ property: "article:modified_time", content: dates.dateModified }]
          : []),
        { property: "article:author", content: "Adrien de Volontat" },
      ],
      jsonLd: [
        buildArticleJsonLd({
          title: guide.title,
          description,
          path,
          datePublished: dates.datePublished,
          dateModified: dates.dateModified,
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
