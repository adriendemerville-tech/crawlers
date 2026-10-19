/**
 * Tests unitaires des outils MCP Search Console (logique pure, aucun réseau).
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  allowedDomains,
  normalizeSiteInput,
  isAllowedSite,
  filterAllowedProperties,
  urlBelongsToProperty,
  decideGscAccess,
  validateSearchAnalytics,
  validateTop,
  validateHistory,
  validateInspection,
  mapGoogleError,
  computeTotals,
  computeTopWithDeltas,
  defaultWindow,
  todayUtc,
  shiftDays,
  gscRequestUrl,
  trackedSiteDomainVariants,
} from './gscMcpCore.ts';

Deno.test('gscRequestUrl : inspection sur Search Console', () => {
  assertEquals(gscRequestUrl('/v1/urlInspection/index:inspect'),
    'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect');
});

Deno.test('gscRequestUrl : autres outils sur Webmasters v3', () => {
  for (const path of [
    '/webmasters/v3/sites',
    '/webmasters/v3/sites/sc-domain%3Acrawlers.fr/searchAnalytics/query',
    '/webmasters/v3/sites/sc-domain%3Acrawlers.fr/sitemaps',
  ]) {
    assertEquals(gscRequestUrl(path), `https://www.googleapis.com${path}`);
  }
});

Deno.test('trackedSiteDomainVariants : domaine nu et www pour chaque domaine autorisé', () => {
  for (const domain of allowedDomains(null)) {
    assertEquals(trackedSiteDomainVariants(domain), [domain, `www.${domain}`]);
    assertEquals(trackedSiteDomainVariants(normalizeSiteInput(`https://www.${domain}/`) ?? ''),
      [domain, `www.${domain}`]);
  }
});

// ── Liste blanche ────────────────────────────────────────────

Deno.test('allowedDomains : 3 domaines par défaut', () => {
  assertEquals(allowedDomains(null), ['dictadevi.io', 'crawlers.fr', 'iktracker.fr']);
  assertEquals(allowedDomains(undefined), ['dictadevi.io', 'crawlers.fr', 'iktracker.fr']);
  assertEquals(allowedDomains(''), ['dictadevi.io', 'crawlers.fr', 'iktracker.fr']);
});

Deno.test('allowedDomains : surcharge par variable d\'environnement', () => {
  assertEquals(allowedDomains('example.com, exemple.test'), ['example.com', 'exemple.test']);
});

Deno.test('normalizeSiteInput : variantes acceptées', () => {
  assertEquals(normalizeSiteInput('crawlers.fr'), 'crawlers.fr');
  assertEquals(normalizeSiteInput('sc-domain:crawlers.fr'), 'crawlers.fr');
  assertEquals(normalizeSiteInput('https://crawlers.fr/'), 'crawlers.fr');
  assertEquals(normalizeSiteInput('http://crawlers.fr/'), 'crawlers.fr');
  assertEquals(normalizeSiteInput('https://www.crawlers.fr/'), 'crawlers.fr');
  assertEquals(normalizeSiteInput('http://www.crawlers.fr'), 'crawlers.fr');
  assertEquals(normalizeSiteInput('  CRAWLERS.FR '), 'crawlers.fr');
});

Deno.test('normalizeSiteInput : entrées invalides', () => {
  assertEquals(normalizeSiteInput(''), null);
  assertEquals(normalizeSiteInput('notadomain'), null);
  assertEquals(normalizeSiteInput(42), null);
  assertEquals(normalizeSiteInput(null), null);
});

Deno.test('isAllowedSite : domaines de la liste acceptés, autres refusés', () => {
  const domains = allowedDomains(null);
  assert(isAllowedSite('dictadevi.io', domains));
  assert(isAllowedSite('sc-domain:iktracker.fr', domains));
  assert(isAllowedSite('https://www.crawlers.fr/', domains));
  assert(!isAllowedSite('example.com', domains));
  assert(!isAllowedSite('', domains));
});

Deno.test('isAllowedSite : sous-domaine piégé refusé', () => {
  const domains = allowedDomains(null);
  assert(!isAllowedSite('dictadevi.io.evil.test', domains));
  assert(!isAllowedSite('sc-domain:dictadevi.io.evil.test', domains));
  assert(!isAllowedSite('https://sub.crawlers.fr/', domains));
});

Deno.test('filterAllowedProperties : ne garde que la liste blanche', () => {
  const entries = [
    { siteUrl: 'sc-domain:crawlers.fr', permissionLevel: 'siteOwner' },
    { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
    { siteUrl: 'sc-domain:dictadevi.io', permissionLevel: 'siteFullUser' },
  ];
  const out = filterAllowedProperties(entries, allowedDomains(null));
  assertEquals(out.length, 2);
  assertEquals(out.map((o) => o.site_url).sort(), ['sc-domain:crawlers.fr', 'sc-domain:dictadevi.io']);
  // Aucune propriété hors liste ne fuite dans le résultat
  assert(!JSON.stringify(out).includes('example.com'));
});

Deno.test('urlBelongsToProperty', () => {
  assert(urlBelongsToProperty('https://crawlers.fr/tarifs', 'crawlers.fr'));
  assert(urlBelongsToProperty('https://www.crawlers.fr/', 'sc-domain:crawlers.fr'));
  assert(!urlBelongsToProperty('https://example.com/', 'crawlers.fr'));
  assert(!urlBelongsToProperty('https://crawlers.fr.evil.test/', 'crawlers.fr'));
  assert(!urlBelongsToProperty('ftp://crawlers.fr/', 'crawlers.fr'));
  assert(!urlBelongsToProperty('pas-une-url', 'crawlers.fr'));
});

// ── Contrôle d'accès ─────────────────────────────────────────

Deno.test('decideGscAccess : non admin refusé', () => {
  const err = decideGscAccess({ isAdmin: false, via: 'jwt' });
  assertEquals(err?.code, -32001);
});

Deno.test('decideGscAccess : JWT admin accepté', () => {
  assertEquals(decideGscAccess({ isAdmin: true, via: 'jwt' }), null);
});

Deno.test('decideGscAccess : clé admin sans permission gsc refusée', () => {
  const err = decideGscAccess({ isAdmin: true, via: 'key', keyServices: ['marina'] });
  assertEquals(err?.code, -32001);
  assert(err!.message.includes('gsc'));
});

Deno.test('decideGscAccess : clé admin avec permission gsc acceptée', () => {
  assertEquals(decideGscAccess({ isAdmin: true, via: 'key', keyServices: ['marina', 'gsc'] }), null);
});

Deno.test('decideGscAccess : pas d\'appelant refusé', () => {
  assertEquals(decideGscAccess(null)?.code, -32001);
});

// ── Schémas d'entrée ─────────────────────────────────────────

Deno.test('validateSearchAnalytics : défauts J-30 → J-2', () => {
  const v = validateSearchAnalytics({ site: 'crawlers.fr' });
  assert(!('code' in v));
  const input = v as { start_date: string; end_date: string; row_limit: number; search_type: string };
  assertEquals(input.end_date, shiftDays(todayUtc(), -2));
  assertEquals(input.row_limit, 1000);
  assertEquals(input.search_type, 'web');
});

Deno.test('validateSearchAnalytics : dates invalides refusées', () => {
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', start_date: '19/10/2026' }));
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', start_date: '2026-02-30' }));
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', end_date: '2999-01-01' }));
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', start_date: '2026-10-10', end_date: '2026-10-01' }));
});

Deno.test('validateSearchAnalytics : plage > 16 mois refusée', () => {
  const v = validateSearchAnalytics({ site: 'crawlers.fr', start_date: '2020-01-01', end_date: '2026-10-17' });
  assert('code' in v);
});

Deno.test('validateSearchAnalytics : dimension inconnue et doublons refusés', () => {
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', dimensions: ['query', 'toto'] }));
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', dimensions: ['query', 'query'] }));
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', dimensions: ['query', 'page', 'country', 'date'] }));
  assert(!('code' in validateSearchAnalytics({ site: 'crawlers.fr', dimensions: ['query', 'page', 'country'] })));
});

Deno.test('validateSearchAnalytics : row_limit et start_row bornés', () => {
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', row_limit: 0 }));
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', row_limit: 5001 }));
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', start_row: -1 }));
  assert(!('code' in validateSearchAnalytics({ site: 'crawlers.fr', row_limit: 5000, start_row: 0 })));
});

Deno.test('validateSearchAnalytics : filtres validés', () => {
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', filters: [{ dimension: 'date', operator: 'equals', expression: 'x' }] }));
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', filters: [{ dimension: 'query', operator: 'regex', expression: 'x' }] }));
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', filters: [{ dimension: 'query', operator: 'contains', expression: 'x'.repeat(501) }] }));
  const six = Array.from({ length: 6 }, () => ({ dimension: 'query', operator: 'contains', expression: 'x' }));
  assert('code' in validateSearchAnalytics({ site: 'crawlers.fr', filters: six }));
  assert(!('code' in validateSearchAnalytics({ site: 'crawlers.fr', filters: [{ dimension: 'page', operator: 'includingRegex', expression: '/blog/.*' }] })));
});

Deno.test('validateTop : bornes', () => {
  assert('code' in validateTop({ site: 'crawlers.fr', days: 14 }));
  assert('code' in validateTop({ site: 'crawlers.fr', limit: 0 }));
  assert('code' in validateTop({ site: 'crawlers.fr', limit: 101 }));
  assert('code' in validateTop({ site: 'crawlers.fr', country: 'FR' }));
  assert('code' in validateTop({ site: 'crawlers.fr', device: 'watch' }));
  const ok = validateTop({ site: 'crawlers.fr', days: 90, limit: 100, country: 'fra', device: 'mobile' });
  assert(!('code' in ok));
});

Deno.test('validateHistory : bornes', () => {
  assert('code' in validateHistory({ site: 'crawlers.fr', days: 0 }));
  assert('code' in validateHistory({ site: 'crawlers.fr', days: 91 }));
  assert(!('code' in validateHistory({ site: 'crawlers.fr', days: 7, query: 'cocon sémantique' })));
});

Deno.test('validateInspection : plus de 5 URLs refusé, URL hors propriété refusée', () => {
  const urls6 = Array.from({ length: 6 }, (_, i) => `https://crawlers.fr/p${i}`);
  assert('code' in validateInspection({ site: 'crawlers.fr', urls: urls6 }));
  assert('code' in validateInspection({ site: 'crawlers.fr', urls: ['https://example.com/'] }));
  assert('code' in validateInspection({ site: 'crawlers.fr', urls: [] }));
  assert(!('code' in validateInspection({ site: 'crawlers.fr', urls: ['https://crawlers.fr/', 'https://www.crawlers.fr/tarifs'] })));
});

// ── Erreurs Google ───────────────────────────────────────────

Deno.test('mapGoogleError : 429 et quotaExceeded', () => {
  const e1 = mapGoogleError(429, {}, '120');
  assertEquals(e1.code, -32002);
  assert(e1.message.includes('120'));
  const e2 = mapGoogleError(403, { error: { errors: [{ reason: 'quotaExceeded' }] } }, null);
  assertEquals(e2.code, -32002);
  const e3 = mapGoogleError(403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }, null);
  assertEquals(e3.code, -32002);
});

Deno.test('mapGoogleError : 401/403 → reconnexion', () => {
  assertEquals(mapGoogleError(401, {}).code, -32001);
  const e = mapGoogleError(403, { error: { errors: [{ reason: 'forbidden' }] } });
  assertEquals(e.code, -32001);
  assert(e.message.includes('reconnecte'));
});

Deno.test('mapGoogleError : autre erreur, sans corps brut', () => {
  const e = mapGoogleError(500, { error: { message: 'secret internal detail' } });
  assertEquals(e.code, -32603);
  assert(!e.message.includes('secret'));
});

// ── Totaux et deltas ─────────────────────────────────────────

Deno.test('computeTotals : position pondérée par impressions', () => {
  const t = computeTotals([
    { keys: ['a'], clicks: 10, impressions: 100, ctr: 0.1, position: 2 },
    { keys: ['b'], clicks: 0, impressions: 900, ctr: 0, position: 10 },
  ]);
  assertEquals(t.clicks, 10);
  assertEquals(t.impressions, 1000);
  assertEquals(t.ctr, 0.01);
  // (2*100 + 10*900) / 1000 = 9.2
  assertEquals(t.position, 9.2);
});

Deno.test('computeTotals : vide', () => {
  assertEquals(computeTotals([]), { clicks: 0, impressions: 0, ctr: 0, position: 0 });
});

Deno.test('computeTopWithDeltas : tri par clics et deltas vs période précédente', () => {
  const current = [
    { keys: ['b'], clicks: 5, impressions: 50, ctr: 0.1, position: 4 },
    { keys: ['a'], clicks: 20, impressions: 200, ctr: 0.1, position: 3 },
    { keys: ['c'], clicks: 1, impressions: 10, ctr: 0.1, position: 8 },
  ];
  const previous = [
    { keys: ['a'], clicks: 15, impressions: 150, ctr: 0.1, position: 5 },
    { keys: ['b'], clicks: 5, impressions: 50, ctr: 0.1, position: 4 },
  ];
  const out = computeTopWithDeltas(current, previous, 2);
  assertEquals(out.length, 2);
  assertEquals(out[0].key, 'a');
  assertEquals(out[0].clicks_delta, 5);
  assertEquals(out[0].position_delta, -2);
  assertEquals(out[1].key, 'b');
  assertEquals(out[1].clicks_delta, 0);
  // 'c' hors limite ; une clé absente de la période précédente a un delta = clics courants
  const out3 = computeTopWithDeltas(current, previous, 3);
  assertEquals(out3[2].clicks_delta, 1);
  assertEquals(out3[2].position_delta, 0);
});

Deno.test('defaultWindow : fin à J-2', () => {
  const w = defaultWindow();
  assertEquals(w.end_date, shiftDays(todayUtc(), -2));
  assert(w.start_date < w.end_date);
});
