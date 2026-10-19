import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  applyBulkDifficulty,
  bareDomain,
  domainPosition,
  estimateBacklinkUsd,
  estimateKeywordResearchUsd,
  estimateSerpUsd,
  normalizeSeeds,
  parseAnchors,
  parseKeywordIdeas,
  parseOrganicSerp,
  parseReferringDomains,
  readKeywordDifficulty,
  resolveLocation,
} from './mcpDataForSeoCore.ts';

Deno.test('keyword_ideas : volume et difficulté via keyword_properties, pas keyword_info', () => {
  const payload = {
    tasks: [{ result: [{ items: [
      {
        keyword: 'prix peinture m2',
        keyword_info: { search_volume: 5400, cpc: 1.2, competition: 0.4, keyword_difficulty: 99 },
        keyword_properties: { keyword_difficulty: 28 },
      },
      {
        keyword_data: {
          keyword: 'prix peinture plafond',
          keyword_info: { search_volume: 720 },
          keyword_properties: { keyword_difficulty: 31 },
        },
      },
      {
        keyword: 'sans difficulté',
        keyword_info: { search_volume: 10, competition_index: 80 },
      },
    ] }] }],
  };
  const ideas = parseKeywordIdeas(payload, 10);
  assertEquals(ideas.map((k) => k.keyword), ['prix peinture m2', 'prix peinture plafond', 'sans difficulté']);
  assertEquals(ideas[0].keyword_difficulty, 28);
  assertEquals(ideas[0].difficulty_source, 'keyword_properties');
  assertEquals(ideas[1].keyword_difficulty, 31);
  assertEquals(ideas[2].keyword_difficulty, null);
  assertEquals(readKeywordDifficulty({ keyword_info: { keyword_difficulty: 99 } }), null);
});

Deno.test('bulk_keyword_difficulty ne remplace pas une difficulté déjà présente', () => {
  const ideas = parseKeywordIdeas({
    tasks: [{ result: [{ items: [
      { keyword: 'alpha', keyword_info: { search_volume: 5 }, keyword_properties: { keyword_difficulty: 12 } },
      { keyword: 'beta', keyword_info: { search_volume: 9 } },
    ] }] }],
  }, 10);
  const merged = applyBulkDifficulty(ideas, {
    tasks: [{ result: [{ items: [
      { keyword: 'alpha', keyword_difficulty: 90 },
      { keyword: 'beta', keyword_difficulty: 44 },
    ] }] }],
  });
  const byName = Object.fromEntries(merged.map((k) => [k.keyword, k]));
  assertEquals(byName['alpha'].keyword_difficulty, 12);
  assertEquals(byName['alpha'].difficulty_source, 'keyword_properties');
  assertEquals(byName['beta'].keyword_difficulty, 44);
  assertEquals(byName['beta'].difficulty_source, 'bulk_keyword_difficulty');
});

Deno.test('serp organique : ignore le payant et situe le domaine', () => {
  const hits = parseOrganicSerp({
    tasks: [{ result: [{ items: [
      { type: 'paid', url: 'https://ads.example/x', rank_absolute: 1, domain: 'ads.example' },
      { type: 'organic', url: 'https://autre.fr/a', rank_absolute: 3, domain: 'autre.fr', title: 'A', description: 'a' },
      { type: 'organic', url: 'https://www.crawlers.fr/blog', rank_absolute: 11, domain: 'www.crawlers.fr', title: 'C', description: 'c' },
    ] }] }],
  }, 10);
  assertEquals(hits.length, 2);
  assertEquals(domainPosition(hits, 'crawlers.fr'), 11);
  assertEquals(domainPosition(hits, 'blog.crawlers.fr'), null);
  assertEquals(domainPosition(hits, null), null);
});

Deno.test('backlinks : plafonne ancres et domaines référents', () => {
  const refs = parseReferringDomains({
    tasks: [{ result: [{ items: [
      { domain: 'a.fr', rank: 10, backlinks: 2 },
      { domain: '', rank: 1, backlinks: 1 },
      { domain: 'b.fr', rank: 3, backlinks: 4 },
    ] }] }],
  }, 1);
  assertEquals(refs, [{ domain: 'a.fr', rank: 10, backlinks: 2 }]);
  const anchors = parseAnchors({
    tasks: [{ result: [{ items: [
      { anchor: '  devis  ', backlinks: 4, referring_domains: 2 },
      { anchor: '', backlinks: 1, referring_domains: 1 },
    ] }] }],
  }, 5);
  assertEquals(anchors, [{ anchor: 'devis', backlinks: 4, referring_domains: 2 }]);
});

Deno.test('garde-fous : graines, pays FR par défaut, domaine', () => {
  assertEquals(normalizeSeeds({ keyword: '  audit seo  ', keywords: ['audit seo', 'geo'] }), ['audit seo', 'geo']);
  assertEquals(resolveLocation(undefined, undefined), { country: 'fr', location_code: 2250 });
  assertEquals(bareDomain('https://www.Crawlers.fr/blog'), 'crawlers.fr');
});

Deno.test('estimations de coût : plafonds documentés', () => {
  assertEquals(estimateKeywordResearchUsd(15, 0), 0.0138);
  assertEquals(estimateKeywordResearchUsd(25, 1), 0.0192);
  assertEquals(estimateSerpUsd(10), 0.002);
  assertEquals(estimateSerpUsd(20), 0.004);
  assertEquals(estimateBacklinkUsd(10, 10), 0.072756);
});
