/**
 * Tests déterministes du recalibrage autorité (confrontation Semrush 2026-08-08).
 * Objectif : figer la courbe de normalisation et la pénalité de toxicité pour
 * qu'aucune régression ne réintroduise un 100/100 fantaisiste.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { computeAuthorityScore, computeBacklinkToxicity, normalizeDomainRank } from './domainAuthority.ts';

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
