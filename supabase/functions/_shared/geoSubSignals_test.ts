/**
 * Tests déterministes du modèle GEO 3 piliers à pondération décroissante.
 * Objectif : figer la courbe de décroissance (demi-vie 18 mois, ancrée au
 * 2026-08-01) pour qu'aucune régression ne brise la somme à 100, la stricte
 * décroissance de l'accessibilité ou le plancher 10.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  geoElapsedMonths,
  geoPillarTotals,
  geoSignalWeightsAt,
  GEO_PILLAR_REL,
} from './geoSubSignals.ts';

const at = (iso: string) => new Date(iso);

Deno.test('geoElapsedMonths : 0 à l’ancre (2026-08-01), ~18 à +18 mois', () => {
  assertEquals(geoElapsedMonths(at('2026-08-01T00:00:00Z')), 0);
  const m18 = geoElapsedMonths(at('2028-02-01T00:00:00Z'));
  assert(Math.abs(m18 - 18) < 0.1, `attendu ~18 mois, obtenu ${m18}`);
});

Deno.test('geoPillarTotals : somme toujours 100, accessibilité décroissante vers 10', () => {
  const t0 = geoPillarTotals(at('2026-08-01T00:00:00Z'));
  assertEquals(Math.round(t0.authority + t0.accessibility + t0.content), 100);
  // À l’ancre : 25 / 25 / 50
  assert(Math.abs(t0.authority - 25) < 1e-6);
  assert(Math.abs(t0.accessibility - 25) < 1e-6);
  assert(Math.abs(t0.content - 50) < 1e-6);

  const t18 = geoPillarTotals(at('2028-02-01T00:00:00Z'));
  const t36 = geoPillarTotals(at('2029-08-01T00:00:00Z'));
  // Décroissance stricte de l'accessibilité.
  assert(t18.accessibility < t0.accessibility);
  assert(t36.accessibility < t18.accessibility);
  // Croissance stricte du contenu.
  assert(t18.content > t0.content);
  assert(t36.content > t18.content);
  // Chaque date conserve la somme à 100.
  assertEquals(Math.round(t18.authority + t18.accessibility + t18.content), 100);
  assertEquals(Math.round(t36.authority + t36.accessibility + t36.content), 100);
  // Plancher 10 : après 10 ans on est à ~10 (jamais sous).
  const t10y = geoPillarTotals(at('2036-08-01T00:00:00Z'));
  assert(t10y.accessibility >= 9.9 && t10y.accessibility <= 10.2, `plancher ~10, obtenu ${t10y.accessibility}`);
  // Autorité domaine constante.
  assertEquals(t0.authority, t18.authority);
  assertEquals(t18.authority, t36.authority);
});

Deno.test('geoSignalWeightsAt : chaque pilier totalise son poids courant', () => {
  const w = geoSignalWeightsAt(at('2026-08-01T00:00:00Z'));
  // Somme des poids relatifs par pilier.
  const sumOf = (keys: string[]) => keys.reduce((a, k) => a + (w[k] ?? 0), 0);
  assertEquals(Math.round(sumOf(['brand_authority', 'serp_presence'])), 25);
  assertEquals(Math.round(sumOf(['bot_accessibility', 'structured_data_quality', 'content_freshness'])), 25);
  assertEquals(Math.round(sumOf(['content_quotability', 'answer_formatting', 'knowledge_graph_signals', 'self_citation_signals', 'person_authority'])), 50);
  // Poids tous > 0.
  for (const v of Object.values(w)) assert(v > 0);
});

Deno.test('geoSignalWeightsAt : mise à l’échelle proportionnelle dans chaque pilier', () => {
  // Les proportions internes d'un pilier sont constantes dans le temps.
  const ratio = (w: Record<string, number>, a: string, b: string) => (w[a] ?? 0) / (w[b] ?? 0);
  const w0 = geoSignalWeightsAt(at('2026-08-01T00:00:00Z'));
  const w18 = geoSignalWeightsAt(at('2028-02-01T00:00:00Z'));
  // bot_accessibility / structured_data_quality reste 14/12 à toute date.
  assert(Math.abs(ratio(w0, 'bot_accessibility', 'structured_data_quality') - 14 / 12) < 1e-3);
  assert(Math.abs(ratio(w18, 'bot_accessibility', 'structured_data_quality') - 14 / 12) < 1e-3);
  // Le poids absolu d'un sous-signal d'accessibilité décroît.
  assert(w18.bot_accessibility < w0.bot_accessibility);
  // Le poids absolu d'un sous-signal de contenu croît.
  assert(w18.content_quotability > w0.content_quotability);
});

Deno.test('GEO_PILLAR_REL : clés alignées sur les 10 sous-signaux, sommes cohérentes', () => {
  assertEquals(Object.keys(GEO_PILLAR_REL.authority).length, 2);
  assertEquals(Object.keys(GEO_PILLAR_REL.accessibility).length, 3);
  assertEquals(Object.keys(GEO_PILLAR_REL.content).length, 5);
  const all = Object.values(GEO_PILLAR_REL).flatMap((r) => Object.keys(r));
  assertEquals(all.length, 10);
  assertEquals(new Set(all).size, 10, 'aucune clé dupliquée entre piliers');
});
