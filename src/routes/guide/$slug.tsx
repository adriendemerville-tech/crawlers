import { createFileRoute } from "@tanstack/react-router";
import GuideLandingPage from "@/pages/GuideLandingPage";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/guide/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("seo_page_drafts" as never)
      .select("title, meta_title, meta_description")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();
    const row = data as { title?: string; meta_title?: string | null; meta_description?: string | null } | null;
    if (!row?.title) return { title: null, description: null };
    return {
      title: row.meta_title || `${row.title} | Crawlers.fr`,
      description:
        row.meta_description ||
        `Guide SEO & GEO Crawlers.fr : ${row.title}. Méthode, checklist et actions concrètes.`,
    };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData?.title) {
      return pageHead({
        title: "Guide introuvable | Crawlers.fr",
        description: "Ce guide SEO & GEO de Crawlers.fr n'est pas disponible.",
        path: `/guide/${params.slug}`,
        noIndex: true,
      });
    }
    return pageHead({
      title: loaderData.title,
      description: loaderData.description!,
      path: `/guide/${params.slug}`,
      ogType: "article",
    });
  },
  component: GuideLandingPage,
});
