/**
 * Tests de non-régression du nœud d'identité canonique (schema.org Organization).
 *
 * Trois garanties :
 *  1. le root injecte bien le graphe sitewide complet dans le head ;
 *  2. les schémas produits par les modules canoniques (pageSchemas, articleSchema)
 *     référencent l'unique `@id` #organization au lieu de recréer un nœud ;
 *  3. aucun nouveau fichier n'introduit un nœud Organization Crawlers non canonique
 *     (liste héritée figée, à réduire, jamais à étendre).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ORGANIZATION_ID,
  ORGANIZATION_NODE,
  ORGANIZATION_REF,
  SITEWIDE_JSONLD,
  WEBSITE_NODE,
} from './organization';
import * as pageSchemas from './pageSchemas';
import { buildArticleJsonLd, buildProfilePageJsonLd } from './articleSchema';

/** Remonte tous les nœuds `{ '@type': 'Organization' }` d'un graphe JSON-LD. */
function collectOrganizationNodes(value: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectOrganizationNodes(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>;
    if (node['@type'] === 'Organization') out.push(node);
    for (const child of Object.values(node)) collectOrganizationNodes(child, out);
  }
  return out;
}

describe('nœud Organization canonique', () => {
  it('expose un @id absolu et stable', () => {
    expect(ORGANIZATION_ID).toBe('https://crawlers.fr/#organization');
    expect(ORGANIZATION_NODE['@id']).toBe(ORGANIZATION_ID);
    expect(ORGANIZATION_REF['@id']).toBe(ORGANIZATION_ID);
  });

  it('porte les preuves attendues par un agent IA', () => {
    expect(ORGANIZATION_NODE.name).toBeTruthy();
    expect(ORGANIZATION_NODE.legalName).toBeTruthy();
    expect(ORGANIZATION_NODE.url).toBe('https://crawlers.fr');
    expect(ORGANIZATION_NODE.logo.url).toMatch(/^https:\/\/crawlers\.fr\//);
    expect(ORGANIZATION_NODE.address.addressCountry).toBe('FR');
    expect(ORGANIZATION_NODE.address.addressLocality).toBeTruthy();
    expect(ORGANIZATION_NODE.contactPoint.length).toBeGreaterThan(0);
    for (const contact of ORGANIZATION_NODE.contactPoint) {
      expect(contact.contactType).toBeTruthy();
      expect(contact.email).toMatch(/@/);
    }
    const siren = ORGANIZATION_NODE.identifier.find((id) => id.propertyID === 'SIREN');
    expect(siren?.value).toMatch(/^\d{9}$/);
    expect(ORGANIZATION_NODE.sameAs.length).toBeGreaterThan(0);
  });

  it('lie le nœud WebSite à cet @id, sans dupliquer le nœud', () => {
    expect(WEBSITE_NODE.publisher).toEqual({ '@id': ORGANIZATION_ID });
  });

  it('émet le nœud complet une seule fois dans le graphe sitewide', () => {
    expect(SITEWIDE_JSONLD['@context']).toBe('https://schema.org');
    const orgs = collectOrganizationNodes(SITEWIDE_JSONLD['@graph']);
    expect(orgs).toHaveLength(1);
    expect(orgs[0]['@id']).toBe(ORGANIZATION_ID);
  });
});

describe('injection dans le root (SSR)', () => {
  const rootSource = readFileSync('src/routes/__root.tsx', 'utf8');

  it('importe le graphe sitewide depuis la source unique', () => {
    expect(rootSource).toMatch(
      /import\s*\{[^}]*SITEWIDE_JSONLD[^}]*\}\s*from\s*["']@\/lib\/seo\/organization["']/,
    );
  });

  it("rend le graphe dans un script application/ld+json du head()", () => {
    expect(rootSource).toContain('application/ld+json');
    expect(rootSource).toMatch(/JSON\.stringify\(\s*SITEWIDE_JSONLD\s*\)/);
  });

  it("n'ajoute pas de nœud Organization concurrent dans le root", () => {
    const inlineOrgNodes = rootSource.match(/["']@type["']\s*:\s*["']Organization["']/g) ?? [];
    expect(inlineOrgNodes).toHaveLength(0);
  });
});

describe('schémas de page', () => {
  const exportedSchemas = Object.entries(pageSchemas).filter(([name]) =>
    name.endsWith('JsonLd'),
  );

  it('expose bien des schémas à tester', () => {
    expect(exportedSchemas.length).toBeGreaterThan(0);
  });

  it.each(exportedSchemas)('%s référence l\'@id #organization', (_name, schema) => {
    for (const node of collectOrganizationNodes(schema)) {
      expect(node['@id']).toBe(ORGANIZATION_ID);
    }
  });

  it('buildArticleJsonLd utilise la référence canonique comme publisher', () => {
    const article = buildArticleJsonLd({
      title: 'Titre de test',
      description: 'Description de test',
      path: '/blog/test',
    } as Parameters<typeof buildArticleJsonLd>[0]);
    const orgs = collectOrganizationNodes(article);
    expect(orgs.length).toBeGreaterThan(0);
    for (const node of orgs) expect(node['@id']).toBe(ORGANIZATION_ID);
  });

  it('buildProfilePageJsonLd rattache la personne au même @id', () => {
    const profile = buildProfilePageJsonLd({
      name: 'Adrien de Volontat',
      jobTitle: 'Fondateur',
      description: 'Test',
      path: '/auteur/adrien-de-volontat',
    } as Parameters<typeof buildProfilePageJsonLd>[0]);
    const orgs = collectOrganizationNodes(profile);
    expect(orgs.length).toBeGreaterThan(0);
    for (const node of orgs) expect(node['@id']).toBe(ORGANIZATION_ID);
  });
});

/**
 * Fichiers historiques déclarant encore un nœud Organization Crawlers en dur.
 * Cette liste est un plafond : elle doit décroître, jamais grandir.
 */
const LEGACY_INLINE_ORGANIZATION_FILES = new Set([
  'src/components/Footer.tsx',
  'src/components/Landing/LandingSeoEnrichment.tsx',
  'src/components/SEOHead.tsx',
  'src/data/articleContents.tsx',
  'src/lib/seo/marinaMentions.ts',
  'src/pages/APropos.tsx',
  'src/pages/AnalyseBotsIA.tsx',
  'src/pages/AnalyseLogs.tsx',
  'src/pages/AnalyseSiteWebGratuit.tsx',
  'src/pages/ArchitecteGeneratif.tsx',
  'src/pages/AuthorPage.tsx',
  'src/pages/BreathingSpiral.tsx',
  'src/pages/ComparatifClaudeVsCrawlers.tsx',
  'src/pages/ComparatifCrawlersAhrefs.tsx',
  'src/pages/ComparatifCrawlersScreamingFrog.tsx',
  'src/pages/ComparatifCrawlersSemrush.tsx',
  'src/pages/ComparatifPlateforme.tsx',
  'src/pages/EEATPage.tsx',
  'src/pages/GenerativeEngineOptimization.tsx',
  'src/pages/GuideAuditSeo.tsx',
  'src/pages/IndiceAlignementStrategique.tsx',
  'src/pages/IntegrationGTM.tsx',
  'src/pages/KeywordPillarPage.tsx',
  'src/pages/Marina.tsx',
  'src/pages/ModifierCodeWordPress.tsx',
  'src/pages/Observatoire.tsx',
  'src/pages/OutilCrawl.tsx',
  'src/pages/RankingSerp.tsx',
  'src/pages/SeaSeoBridge.tsx',
  'src/pages/Tarifs.tsx',
  'src/pages/developers/DevLanding.tsx',
  'src/pages/docs/CrawlersApiDoc.tsx',
  'src/pages/docs/MarinaApiDoc.tsx',
  'src/pages/docs/ParmenionApiDoc.tsx',
  'src/pages/etudes/AutopilotIktracker.tsx',
  'src/pages/etudes/CoutChatGPTvsGoogleAds.tsx',
  'src/routes/contact.tsx',
  'src/routes/developers/docs.tsx',
  'src/routes/developers/index.tsx',
  'src/routes/developers/sdks.tsx',
  'src/routes/guides/index.tsx',
  'src/routes/marina.tsx',
  'src/routes/marketplace-backlinks.tsx',
  'src/routes/observatoire.tsx',
]);

function walkSources(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walkSources(path, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\./.test(entry)) {
      out.push(path.replace(/\\/g, '/'));
    }
  }
  return out;
}

describe('garde anti-régression : pas de nouveau nœud Organization en dur', () => {
  it('aucun fichier hors liste héritée ne recrée le nœud Crawlers', () => {
    const offenders: string[] = [];
    for (const file of walkSources('src')) {
      if (file === 'src/lib/seo/organization.ts') continue;
      const source = readFileSync(file, 'utf8');
      const pattern = /["']@type["']\s*:\s*["']Organization["']/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source))) {
        const segment = source.slice(Math.max(0, match.index - 500), match.index + 700);
        const canonical =
          segment.includes('#organization') ||
          segment.includes('ORGANIZATION_REF') ||
          segment.includes('ORGANIZATION_ID');
        if (canonical) continue;
        const isCrawlersOwned =
          /name["']?\s*:\s*["']Crawlers/.test(segment) ||
          (segment.includes('SITE_URL') && /crawlers/i.test(segment));
        if (isCrawlersOwned && !LEGACY_INLINE_ORGANIZATION_FILES.has(file)) {
          offenders.push(file);
          break;
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
