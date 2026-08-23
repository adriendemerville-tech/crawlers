/**
 * Tests déterministes du recalibrage autorité (confrontation Semrush 2026-08-08).
 * Objectif : figer la courbe de normalisation et la pénalité de toxicité pour
 * qu'aucune régression ne réintroduise un 100/100 fantaisiste.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  computeAuthorityScore,
  computeBacklinkDistribution,
  computeBacklinkToxicity,
  computeOwnNetworkHygiene,
  extractAnchorsFromEndpoint,
  extractDistribution,
  extractLinkedPages,
  normalizeDomainRank,
  segmentReferringDomains,
} from './domainAuthority.ts';

Deno.test('normalizeDomainRank : courbe 0-1000 → 0-95', () => {
  assertEquals(normalizeDomainRank(0), 0);
  assert(normalizeDomainRank(1000) <= 95 && normalizeDomainRank(1000) >= 94);
  const r600 = normalizeDomainRank(600);
  assert(r600 > 34 && r600 < 42, `rank 600 attendu ~38, obtenu ${r600}`);
  const r300 = normalizeDomainRank(300);
  assert(r300 > 8 && r300 < 15, `rank 300 attendu ~11, obtenu ${r300}`);
  // Monotone croissante
  assert(normalizeDomainRank(200) < normalizeDomainRank(400));
});

Deno.test('computeAuthorityScore : plafonné à 92, jamais 100', () => {
  const max = computeAuthorityScore(100, 1_000_000, { avgReferrerRank: 100 });
  assert(max <= 92, `score max attendu <= 92, obtenu ${max}`);
  assertEquals(computeAuthorityScore(0, 0), 0);
});

Deno.test('computeAuthorityScore : un profil toxique est pénalisé', () => {
  const clean = computeAuthorityScore(40, 1000, { toxicityScore: 0, avgReferrerRank: 45 });
  const toxic = computeAuthorityScore(40, 1000, { toxicityScore: 80, avgReferrerRank: 5 });
  assert(toxic < clean, `profil toxique (${toxic}) doit scorer sous un profil sain (${clean})`);
});

Deno.test('computeBacklinkToxicity : ancre suroptimisée + annuaires = pollué', () => {
  const t = computeBacklinkToxicity({
    anchors: [
      { anchor: 'site web', count: 10775 },
      { anchor: 'avenir renovations', count: 300 },
    ],
    topReferringDomains: [
      { domain: 'devis-isolation-gratuit.fr', rank: 40, backlinks: 4632 },
      { domain: 'annuaire-x.fr', rank: 20, backlinks: 800 },
      { domain: 'mfa-y.fr', rank: 30, backlinks: 500 },
    ],
    backlinksTotal: 30450,
    referringDomains: 1170,
    brokenBacklinks: 500,
    dofollowRatio: 99,
  });
  assertEquals(t.verdict, 'pollue');
  assert(t.toxicity_score >= 60);
  assert(t.signals.length >= 2);
});

Deno.test('computeBacklinkToxicity : profil naturel = sain', () => {
  const t = computeBacklinkToxicity({
    anchors: [
      { anchor: 'crawlers audit seo', count: 40 },
      { anchor: 'outil geo crawlers', count: 35 },
      { anchor: 'plateforme seo française', count: 30 },
      { anchor: 'adrien de volontat', count: 25 },
    ],
    topReferringDomains: [
      { domain: 'lemonde.fr', rank: 900, backlinks: 3 },
      { domain: 'blogduseo.fr', rank: 500, backlinks: 2 },
      { domain: 'journaldunet.com', rank: 800, backlinks: 4 },
    ],
    backlinksTotal: 120,
    referringDomains: 60,
    brokenBacklinks: 1,
    dofollowRatio: 70,
  });
  assertEquals(t.verdict, 'sain');
  assert(t.toxicity_score < 35);
});

Deno.test("extractAnchorsFromEndpoint : ancres mesurées triées par volume", () => {
  const payload = {
    tasks: [{
      result: [{
        items: [
          { anchor: 'rénovation maison', backlinks: 12 },
          { anchor: 'https://exemple.fr', backlinks: 80 },
          { anchor: '', backlinks: 999 },
          { anchor: 'cliquez ici', referring_domains: 3 },
        ],
      }],
    }],
  };
  const anchors = extractAnchorsFromEndpoint(payload);
  assertEquals(anchors.length, 3);
  assertEquals(anchors[0].anchor, 'https://exemple.fr');
  assertEquals(anchors[0].count, 80);
  assertEquals(extractAnchorsFromEndpoint({}).length, 0);
});

Deno.test("computeBacklinkToxicity : l'échantillon élargi révèle ce que le top 10 masque", () => {
  const anchors = [
    { anchor: 'rénovation maison ancienne', count: 10 },
    { anchor: 'travaux de toiture', count: 9 },
    { anchor: 'isolation thermique par extérieur', count: 8 },
    { anchor: 'avenir renovations avis', count: 7 },
  ];
  const top = Array.from({ length: 10 }, (_, i) => ({ domain: `bon-site-${i}.fr`, rank: 600, backlinks: 2 }));
  const sample = [
    ...top,
    ...Array.from({ length: 40 }, (_, i) => ({ domain: `annuaire-${i}.info`, rank: 20, backlinks: 1 })),
    { domain: 'casino-bonus.ru', rank: 10, backlinks: 5 },
  ];
  const base = {
    anchors, topReferringDomains: top, backlinksTotal: 120,
    referringDomains: 51, brokenBacklinks: 0, dofollowRatio: 70,
  };
  const withSample = computeBacklinkToxicity({ ...base, sampleReferringDomains: sample });
  const withoutSample = computeBacklinkToxicity(base);
  assert(
    withSample.avg_referrer_rank < withoutSample.avg_referrer_rank,
    `échantillon élargi attendu plus bas : ${withSample.avg_referrer_rank} vs ${withoutSample.avg_referrer_rank}`,
  );
  assert(withSample.verdict !== 'sain', 'un référent hors-sujet interdit le verdict sain');
  assertEquals(withoutSample.verdict, 'sain');
});

// ============ Lot 2 : répartition TLD / pays / pages cibles ============

Deno.test('extractDistribution : parts calculées et tri décroissant', () => {
  const d = extractDistribution({ '.fr': 80, '.com': 15, '.org': 5, '.xyz': 0 });
  assertEquals(d.length, 3);
  assertEquals(d[0].key, '.fr');
  assertEquals(Math.round(d[0].share * 100), 80);
  assert(d[0].share > d[1].share);
  assertEquals(extractDistribution(null).length, 0);
});

Deno.test('extractLinkedPages : tri par domaines référents et URL requise', () => {
  const pages = extractLinkedPages({
    tasks: [{ result: [{ items: [
      { page_address: 'https://x.fr/a', referring_domains: 3, backlinks: 4 },
      { page_address: 'https://x.fr/b', referring_domains: 12, backlinks: 20 },
      { page_address: '', referring_domains: 99, backlinks: 99 },
    ] }] }],
  });
  assertEquals(pages.length, 2);
  assertEquals(pages[0].url, 'https://x.fr/b');
  assertEquals(extractLinkedPages({}).length, 0);
});

Deno.test('computeBacklinkDistribution : dépendance à une page unique détectée', () => {
  const d = computeBacklinkDistribution({
    tld: extractDistribution({ '.fr': 95, '.com': 5 }),
    countries: extractDistribution({ FR: 98, BE: 2 }),
    platformTypes: [],
    linkedPages: [
      { url: 'https://x.fr/', referring_domains: 45, backlinks: 90 },
      { url: 'https://x.fr/contact', referring_domains: 2, backlinks: 2 },
    ],
    referringDomains: 50,
  });
  assert(d.top_page_share >= 0.8, `part attendue élevée : ${d.top_page_share}`);
  assert(d.signals.some((s) => /page unique/.test(s)));
  assert(/Diluer/.test(d.recommendation));
  assertEquals(d.source, 'dataforseo');
});

Deno.test('computeBacklinkDistribution : absence de données ne fabrique aucun constat', () => {
  const d = computeBacklinkDistribution({
    tld: [], countries: [], platformTypes: [], linkedPages: [], referringDomains: 0,
  });
  assertEquals(d.source, 'unavailable');
  assertEquals(d.signals.length, 0);
  assert(/non mesurable/.test(d.recommendation));
});

// ─── Segmentation en trois compartiments (2026-08-23) ───

Deno.test('segmentReferringDomains : propriété prouvée avant racine de marque', () => {
  const seg = segmentReferringDomains(
    'avenir-renovations.fr',
    [
      { domain: 'avenir-renovations.be', rank: 400, backlinks: 300 },
      { domain: 'partenaire-metallerie.fr', rank: 500, backlinks: 2 },
      { domain: 'annuaire-pro.fr', rank: 90, backlinks: 40 },
      { domain: 'lemoniteur.fr', rank: 700, backlinks: 3 },
    ],
    ['partenaire-metallerie.fr'],
  );
  assertEquals(seg.own_network.domains, 2);
  assertEquals(seg.own_network_source, 'mixed');
  assertEquals(
    seg.own_network_domains.find((d) => d.domain === 'partenaire-metallerie.fr')?.source,
    'verified',
  );
  assertEquals(
    seg.own_network_domains.find((d) => d.domain === 'avenir-renovations.be')?.source,
    'suspected',
  );
  assertEquals(seg.directory_platform.domains, 1);
  assertEquals(seg.third_party_editorial.domains, 1);
});

Deno.test('computeBacklinkToxicity : liens/domaine et ancre corrigés du réseau propre', () => {
  const sample = [
    { domain: 'avenir-renovations.be', rank: 400, backlinks: 6000 },
    { domain: 'avenir-renovations.lu', rank: 380, backlinks: 4000 },
    { domain: 'lemoniteur.fr', rank: 700, backlinks: 5 },
    { domain: 'batiactu.com', rank: 650, backlinks: 4 },
    { domain: 'blogperso.fr', rank: 300, backlinks: 3 },
  ];
  const t = computeBacklinkToxicity({
    anchors: [{ anchor: 'France', count: 42 }, { anchor: 'rénovation intérieure', count: 58 }],
    topReferringDomains: sample,
    sampleReferringDomains: sample,
    backlinksTotal: 20000,
    referringDomains: 500,
    brokenBacklinks: 100,
    dofollowRatio: 92,
    auditedDomain: 'avenir-renovations.fr',
  });
  assertEquals(t.scope, 'third_party_only');
  // 20000 liens / 500 domaines = 40 tous référents ; hors réseau propre : 10000/498 ≈ 20,1
  assertEquals(t.links_per_domain_all, 40);
  assertEquals(t.links_per_domain < 25, true);
  // Le réseau propre pèse 50 % des liens → pénalité d'ancre minorée, jamais affirmée
  assertEquals(t.anchor_attribution, 'all_referrers_downgraded');
  assertEquals(/désavou/i.test(t.recommendation), false);
});

Deno.test("computeOwnNetworkHygiene : footer répliqué se corrige à la source, jamais par désaveu", () => {
  const seg = segmentReferringDomains(
    'avenir-renovations.fr',
    [
      { domain: 'avenir-renovations.be', rank: 400, backlinks: 6000 },
      { domain: 'avenir-renovations.lu', rank: 380, backlinks: 4000 },
      { domain: 'lemoniteur.fr', rank: 700, backlinks: 5 },
    ],
  );
  const h = computeOwnNetworkHygiene(seg, 'France', 0.42);
  assertEquals(h.verdict, 'a_corriger_a_la_source');
  assertEquals(h.sitewide_suspected, true);
  assertEquals(/Ne pas désavouer/i.test(h.recommendation), true);
});

Deno.test("computeOwnNetworkHygiene : aucun réseau propre = aucun constat inventé", () => {
  const seg = segmentReferringDomains('crawlers.fr', [{ domain: 'lemoniteur.fr', rank: 700, backlinks: 4 }]);
  const h = computeOwnNetworkHygiene(seg, null, 0);
  assertEquals(h.verdict, 'non_mesure');
  assertEquals(h.signals.length, 0);
});
