/**
 * Shared parser for guide pages stored in `seo_page_drafts`.
 *
 * Used by both the /guide/$slug route loader (SSR) and the page component,
 * so the guide body is present in the server-rendered HTML.
 */

import type { GuideData, GuideSection, GuideFaq } from '@/components/Guide/GuideTemplate';

import heroArtisan from '@/assets/guides/guide-artisan-seo.webp';
import heroBtp from '@/assets/guides/guide-btp-seo.webp';
import heroRestaurant from '@/assets/guides/guide-restaurant-seo.webp';
import heroAvocat from '@/assets/guides/guide-avocat-seo.webp';
import heroMedecin from '@/assets/guides/guide-medecin-seo.webp';
import heroImmobilier from '@/assets/guides/guide-immobilier-seo.webp';
import heroEcommerce from '@/assets/guides/guide-ecommerce-seo.webp';
import heroCoach from '@/assets/guides/guide-coach-seo.webp';
import heroPhotographe from '@/assets/guides/guide-photographe-seo.webp';
import heroPme from '@/assets/guides/guide-pme-seo.webp';
import heroAgence from '@/assets/guides/guide-agence-seo.webp';
import heroConsultant from '@/assets/guides/guide-consultant-seo.webp';
import heroSaas from '@/assets/guides/guide-saas-seo.webp';
import heroStartup from '@/assets/guides/guide-startup-seo.webp';
import heroFreelance from '@/assets/guides/guide-freelance-seo.webp';
import heroMarketplace from '@/assets/guides/guide-marketplace-seo.webp';

export const HERO_IMAGES: Record<string, string> = {
  'artisan-seo': heroArtisan,
  'btp-seo': heroBtp,
  'restaurant-seo': heroRestaurant,
  'avocat-seo': heroAvocat,
  'medecin-seo': heroMedecin,
  'immobilier-seo': heroImmobilier,
  'ecommerce-seo': heroEcommerce,
  'coach-seo': heroCoach,
  'photographe-seo': heroPhotographe,
  'pme-seo': heroPme,
  'agence-seo': heroAgence,
  'consultant-seo': heroConsultant,
  'saas-seo': heroSaas,
  'startup-seo': heroStartup,
  'freelance-seo': heroFreelance,
  'marketplace-seo': heroMarketplace,
};

export function parseGuideFromDb(row: any): GuideData {
  const ctx = row.generation_context || {};

  const sections: GuideSection[] = [];
  const rawContent = row.content || '';
  const h2Parts = rawContent.split(/(?=^## )/m).filter(Boolean);

  for (const part of h2Parts) {
    const lines = part.trim().split('\n');
    const h2Match = lines[0]?.match(/^## (.+)/);
    if (!h2Match) continue;

    const h2 = h2Match[1];
    const bodyLines = lines.slice(1);

    const h3s: { title: string; content: string }[] = [];
    let currentContent = '';
    let citablePassage: string | undefined;

    for (const line of bodyLines) {
      const h3Match = line.match(/^### (.+)/);
      if (h3Match) {
        h3s.push({ title: h3Match[1], content: '' });
        continue;
      }

      // Detect citable passage (blockquote in markdown) — only first one
      const quoteMatch = line.match(/^> (.+)/);
      if (quoteMatch && !citablePassage) {
        citablePassage = quoteMatch[1];
        continue;
      }

      if (h3s.length > 0) {
        h3s[h3s.length - 1].content += line + '\n';
      } else {
        currentContent += line + '\n';
      }
    }

    sections.push({
      h2,
      content: currentContent.trim(),
      citablePassage,
      h3s: h3s.length > 0 ? h3s.map((h) => ({ ...h, content: h.content.trim() })) : undefined,
      cta: ctx.section_ctas?.[h2]
        ? { label: ctx.section_ctas[h2].label, href: ctx.section_ctas[h2].href }
        : undefined,
      howToSteps: ctx.howto_steps?.[h2],
    });
  }

  const faqs: GuideFaq[] = ctx.faqs || [];

  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.meta_description || '',
    metaTitle: row.meta_title || row.title,
    metaDescription: row.meta_description || '',
    targetKeyword: row.target_keyword || '',
    heroCtaLabel: ctx.hero_cta_label || 'Lancer mon audit gratuit',
    heroCtaHref: ctx.hero_cta_href || '/audit-expert',
    heroImage: HERO_IMAGES[row.slug] || undefined,
    publishedAt: row.published_at || row.created_at,
    updatedAt: row.updated_at,
    sections,
    faqs,
    externalLinks: ctx.external_links || [],
    lateralLinks: ctx.lateral_links || [],
    tools: ctx.tools || [],
    category: ctx.guide_category || 'bloc_a',
  };
}
