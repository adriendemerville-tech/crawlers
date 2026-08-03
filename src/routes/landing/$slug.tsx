import { createFileRoute } from "@tanstack/react-router";
import LandingPage from "@/pages/LandingPage";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo/pageHead";

export const Route = createFileRoute("/landing/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("seo_page_drafts" as never)
      .select("title, meta_title, meta_description")
      .eq("slug", params.slug)
      .eq("status", "published")
      .eq("page_type", "landing")
      .maybeSingle();
    const row = data as { title?: string; meta_title?: string | null; meta_description?: string | null } | null;
    if (!row?.title) return { title: null, description: null };
    return {
      title: row.meta_title || `${row.title} | Crawlers.fr`,
      description:
        row.meta_description || `${row.title} — audit SEO & GEO et plan d'action par Crawlers.fr.`,
    };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData?.title) {
      return pageHead({
        title: "Page introuvable | Crawlers.fr",
        description: "Cette page Crawlers.fr n'est pas disponible.",
        path: `/landing/${params.slug}`,
        noIndex: true,
      });
    }
    return pageHead({
      title: loaderData.title,
      description: loaderData.description!,
      path: `/landing/${params.slug}`,
    });
  },
  component: LandingPage,
});
