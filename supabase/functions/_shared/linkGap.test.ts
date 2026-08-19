import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { toDomain, resolveCompetitorDomains, parseIntersection, buildLinkGapWorkbenchItems, buildLinkGapPromptSection, type LinkGapResult } from './linkGap.ts';

Deno.test('toDomain normalise et rejette les plateformes génériques', () => {
  assertEquals(toDomain('https://www.Exemple.fr/page?a=1'), 'exemple.fr');
  assertEquals(toDomain('facebook.com/page'), null);
  assertEquals(toDomain('Mon Concurrent'), null);
});

Deno.test('resolveCompetitorDomains dédoublonne, exclut le site et plafonne à 3', () => {
  const out = resolveCompetitorDomains(
    { identityCompetitors: 'a.fr, https://b.fr/x, Nom Sans Domaine, a.fr', competitorUrls: ['https://c.fr', 'https://d.fr', 'https://www.moi.fr'] },
    'moi.fr',
  );
  assertEquals(out, ['a.fr', 'b.fr', 'c.fr']);
});

Deno.test('parseIntersection exclut les domaines qui lient déjà le site et trie par partage', () => {
  const raw = {
    tasks: [{ result: [{ items: [
      { domain: 'presse.fr', rank: 500, intersections: { '2': { target: 'a.fr', backlinks: 3 } } },
      { domain: 'deja.fr', rank: 900, intersections: { '1': { target: 'moi.fr', backlinks: 1 }, '2': { target: 'a.fr', backlinks: 1 } } },
      { domain: 'annuaire.fr', rank: 200, intersections: { '2': { target: 'a.fr', backlinks: 1 }, '3': { target: 'b.fr', backlinks: 2 } } },
    ] }] }],
  };
  const out = parseIntersection(raw, ['a.fr', 'b.fr'], 'moi.fr');
  assertEquals(out.map((o) => o.domain), ['annuaire.fr', 'presse.fr']);
  assertEquals(out[0].competitors_linking, ['a.fr', 'b.fr']);
  assertEquals(out[0].backlinks, 3);
});

const gap: LinkGapResult = {
  domain: 'moi.fr',
  competitors: ['a.fr', 'b.fr'],
  opportunities: [
    { domain: 'annuaire.fr', rank: 55, competitors_linking: ['a.fr', 'b.fr'], backlinks: 3 },
    { domain: 'presse.fr', rank: 30, competitors_linking: ['a.fr'], backlinks: 1 },
  ],
  gap_count: 2,
  shared_gap_count: 1,
  signals: ['1 domaine référent de rank ≥ 40'],
  recommendation: 'Priorisez annuaire.fr.',
  source: 'dataforseo',
  fetched_at: new Date().toISOString(),
};

Deno.test('buildLinkGapWorkbenchItems produit un constat de synthèse + des tâches unitaires', () => {
  const items = buildLinkGapWorkbenchItems(gap, { userId: 'u1', trackedSiteId: 's1', sourceFunction: 'marina' });
  assertEquals(items.length, 3);
  assertEquals(items.every((i) => i.finding_category === 'link_gap'), true);
  assertEquals(items.every((i) => i.source_type === 'audit_strategic'), true);
  assertEquals(items[0].source_record_id, 'link_gap_moi.fr');
  assertEquals(items[1].source_record_id, 'link_gap_moi.fr_annuaire.fr');
  assertEquals(items[1].severity, 'warning');
});

Deno.test('aucun constat si la mesure est indisponible', () => {
  const items = buildLinkGapWorkbenchItems({ ...gap, source: 'unavailable', opportunities: [] }, { userId: 'u', trackedSiteId: null, sourceFunction: 'x' });
  assertEquals(items.length, 0);
});

Deno.test('le prompt refuse d\'inventer un gap non mesuré', () => {
  assertEquals(buildLinkGapPromptSection(null).includes('non mesuré'), true);
  assertEquals(buildLinkGapPromptSection(gap).includes('annuaire.fr'), true);
});
