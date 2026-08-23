/**
 * Tests déterministes du modèle GEO 3 piliers à barème FIXE 25 / 22 / 53.
 * Objectif : figer le barème pour qu'aucune régression ne brise la somme à 100
 * ni la répartition des points entre sous-signaux.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  geoPillarTotals,
  geoSignalWeightsAt,
  GEO_PILLAR_POINTS,
  GEO_PILLAR_REL,
} from './geoSubSignals.ts';

const at = (iso: string) => new Date(iso);

Deno.test('GEO_PILLAR_POINTS : barème 25 / 22 / 53, somme 100', () => {
  assertEquals(GEO_PILLAR_POINTS.authority, 25);
  assertEquals(GEO_PILLAR_POINTS.accessibility, 22);
  assertEquals(GEO_PILLAR_POINTS.content, 53);
  assertEquals(
    GEO_PILLAR_POINTS.authority + GEO_PILLAR_POINTS.accessibility + GEO_PILLAR_POINTS.content,
    100,
  );
});

Deno.test('geoPillarTotals : identique à toute date (barème fixe)', () => {
  const dates = ['2026-08-01T00:00:00Z', '2028-02-01T00:00:00Z', '2036-08-01T00:00:00Z'];
  for (const d of dates) {
    const t = geoPillarTotals(at(d));
    assertEquals(t.authority, 25);
    assertEquals(t.accessibility, 22);
    assertEquals(t.content, 53);
    assertEquals(t.authority + t.accessibility + t.content, 100);
  }
});

Deno.test('geoSignalWeightsAt : chaque pilier totalise son poids fixe', () => {
  const w = geoSignalWeightsAt(at('2026-08-01T00:00:00Z'));
  const sumOf = (keys: string[]) => keys.reduce((a, k) => a + (w[k] ?? 0), 0);
  assertEquals(Math.round(sumOf(['brand_authority', 'serp_presence'])), 25);
  assertEquals(Math.round(sumOf(['bot_accessibility', 'structured_data_quality', 'content_freshness'])), 22);
  assertEquals(
    Math.round(sumOf([
      'content_quotability',
      'answer_formatting',
      'knowledge_graph_signals',
      'self_citation_signals',
      'person_authority',
    ])),
    53,
  );
  for (const v of Object.values(w)) assert(v > 0);
});

Deno.test('geoSignalWeightsAt : proportions internes conservées et stables dans le temps', () => {
  const ratio = (w: Record<string, number>, a: string, b: string) => (w[a] ?? 0) / (w[b] ?? 0);
  const w0 = geoSignalWeightsAt(at('2026-08-01T00:00:00Z'));
  const w18 = geoSignalWeightsAt(at('2028-02-01T00:00:00Z'));
  assert(Math.abs(ratio(w0, 'bot_accessibility', 'structured_data_quality') - 14 / 12) < 1e-3);
  assert(Math.abs(ratio(w18, 'bot_accessibility', 'structured_data_quality') - 14 / 12) < 1e-3);
  // Barème fixe : aucun poids ne bouge d'une date à l'autre.
  for (const k of Object.keys(w0)) assert(Math.abs((w0[k] ?? 0) - (w18[k] ?? 0)) < 1e-9);
});

Deno.test('GEO_PILLAR_REL : clés alignées sur les 10 sous-signaux, sommes cohérentes', () => {
  assertEquals(Object.keys(GEO_PILLAR_REL.authority).length, 2);
  assertEquals(Object.keys(GEO_PILLAR_REL.accessibility).length, 3);
  assertEquals(Object.keys(GEO_PILLAR_REL.content).length, 5);
  const all = Object.values(GEO_PILLAR_REL).flatMap((r) => Object.keys(r));
  assertEquals(all.length, 10);
  assertEquals(new Set(all).size, 10, 'aucune clé dupliquée entre piliers');
});
