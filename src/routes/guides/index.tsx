import { createFileRoute } from "@tanstack/react-router";
import GuidesHub from "@/pages/GuidesHub";
import { pageHead } from "@/lib/seo/pageHead";
import { supabase } from "@/integrations/supabase/client";

export interface GuideEntry {
  slug: string;
  title: string;
  meta_description: string | null;
  guide_category: string | null;
}

export const Route = createFileRoute("/guides/")({
  // Chargé côté serveur : la liste des guides (titres + liens) doit figurer
  // dans le HTML initial, sinon les crawlers IA ne voient qu'un hero vide.
  loader: async (): Promise<GuideEntry[]> => {
    const { data } = await supabase
      .from("seo_page_drafts" as any)
      .select("slug, title, meta_description, guide_category")
      .eq("page_type", "guide")
      .eq("status", "published")
      .order("created_at", { ascending: true });
    return (data as unknown as GuideEntry[]) ?? [];
  },
  head: () => pageHead({
    title: "Guides SEO & GEO par métier | Crawlers",
    description: "Guides pratiques SEO et GEO adaptés à votre métier : artisan, commerçant, PME, startup, agence SEO, consultant. Améliorez votre visibilité sur Google et les IA.",
    path: "/guides",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Guides SEO & GEO par métier et profil",
        description:
          "Guides pratiques pour améliorer votre visibilité sur Google et les moteurs de recherche IA, adaptés à votre métier.",
        url: "https://crawlers.fr/guides",
        publisher: { "@type": "Organization", name: "Crawlers", url: "https://crawlers.fr" },
      },
    ],
  }),
  component: GuidesHub,
});
