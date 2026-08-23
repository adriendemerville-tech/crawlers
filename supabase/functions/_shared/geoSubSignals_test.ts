/**
 * Tests déterministes du barème GEO 3 piliers.
 * Ancre 2026-08-23 : autorité 25 (constante), accessibilité 22 puis −1 pt par
 * tranche de 18 mois jusqu'au plancher 17, contenu = le reste (53 → 58).
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  geoAccessibilityPoints,
  geoElapsedMonths,
  geoPillarTotals,
  geoSignalWeightsAt,
  GEO_ACCESSIBILITY_FLOOR,
  GEO_PILLAR_REL,
  buildGeoSubSignals,
  GEO_CALIBRATION_MAX_PCT,
  GEO_CALIBRATION_MIN_OBSERVATIONS,
  GEO_CALIBRATION_NEUTRAL_PCT,
} from './geoSubSignals.ts';

const at = (iso: string) => new Date(iso);

Deno.test('geoElapsedMonths : 0 à l’ancre (2026-08-23), ~18 à +18 mois', () => {
  assertEquals(geoElapsedMonths(at('2026-08-23T00:00:00Z')), 0);
  assertEquals(geoElapsedMonths(at('2026-01-01T00:00:00Z')), 0, 'avant l’ancre : 0');
  const m18 = geoElapsedMonths(at('2028-02-23T00:00:00Z'));
  assert(Math.abs(m18 - 18) < 0.1, `attendu ~18 mois, obtenu ${m18}`);
});

Deno.test('geoAccessibilityPoints : marches de 1 pt tous les 18 mois, plancher 17', () => {
  assertEquals(geoAccessibilityPoints(at('2026-08-23T00:00:00Z')), 22);
  // Palier stable pendant 18 mois.
  assertEquals(geoAccessibilityPoints(at('2027-06-01T00:00:00Z')), 22);
  assertEquals(geoAccessibilityPoints(at('2028-02-24T00:00:00Z')), 21);
  assertEquals(geoAccessibilityPoints(at('2029-08-24T00:00:00Z')), 20);
  assertEquals(geoAccessibilityPoints(at('2031-02-24T00:00:00Z')), 19);
  assertEquals(geoAccessibilityPoints(at('2032-08-24T00:00:00Z')), 18);
  assertEquals(geoAccessibilityPoints(at('2034-02-24T00:00:00Z')), 17);
  // Plancher : ne descend jamais sous 17, même très loin dans le temps.
  assertEquals(geoAccessibilityPoints(at('2050-01-01T00:00:00Z')), GEO_ACCESSIBILITY_FLOOR);
});

Deno.test('geoPillarTotals : somme 100 à toute date, contenu absorbe la baisse', () => {
  const dates = ['2026-08-23', '2028-02-24', '2029-08-24', '2034-02-24', '2050-01-01'];
  let prevAccess = Infinity;
  let prevContent = -Infinity;
  for (const d of dates) {
    const t = geoPillarTotals(at(`${d}T00:00:00Z`));
    assertEquals(t.authority, 25, `autorité constante au ${d}`);
    assertEquals(t.authority + t.accessibility + t.content, 100, `somme 100 au ${d}`);
    assert(t.accessibility <= prevAccess, `accessibilité non croissante au ${d}`);
    assert(t.content >= prevContent, `contenu non décroissant au ${d}`);
    prevAccess = t.accessibility;
    prevContent = t.content;
  }
  // Bornes du barème.
  const t0 = geoPillarTotals(at('2026-08-23T00:00:00Z'));
  assertEquals([t0.authority, t0.accessibility, t0.content], [25, 22, 53]);
  const tEnd = geoPillarTotals(at('2050-01-01T00:00:00Z'));
  assertEquals([tEnd.authority, tEnd.accessibility, tEnd.content], [25, 17, 58]);
});

Deno.test('geoSignalWeightsAt : chaque pilier totalise son poids courant', () => {
  const w = geoSignalWeightsAt(at('2026-08-23T00:00:00Z'));
  const sumOf = (keys: string[]) => keys.reduce((a, k) => a + (w[k] ?? 0), 0);
  assertEquals(Math.round(sumOf(['brand_authority', 'serp_presence'])), 25);
  assertEquals(Math.round(sumOf(['bot_accessibility', 'structured_data_quality', 'ai_bot_policy', 'content_freshness'])), 22);
  assertEquals(
    Math.round(sumOf(['content_quotability', 'answer_formatting', 'knowledge_graph_signals', 'self_citation_signals', 'person_authority'])),
    53,
  );
  for (const v of Object.values(w)) assert(v > 0);

  // Au plancher, l'accessibilité totalise 17 et le contenu 58.
  const wEnd = geoSignalWeightsAt(at('2050-01-01T00:00:00Z'));
  const sumEnd = (keys: string[]) => keys.reduce((a, k) => a + (wEnd[k] ?? 0), 0);
  assertEquals(Math.round(sumEnd(['bot_accessibility', 'structured_data_quality', 'ai_bot_policy', 'content_freshness'])), 17);
  assertEquals(
    Math.round(sumEnd(['content_quotability', 'answer_formatting', 'knowledge_graph_signals', 'self_citation_signals', 'person_authority'])),
    58,
  );
});

Deno.test('geoSignalWeightsAt : proportions internes constantes dans le temps', () => {
  const ratio = (w: Record<string, number>, a: string, b: string) => (w[a] ?? 0) / (w[b] ?? 0);
  const w0 = geoSignalWeightsAt(at('2026-08-23T00:00:00Z'));
  const wLate = geoSignalWeightsAt(at('2034-02-24T00:00:00Z'));
  assert(Math.abs(ratio(w0, 'bot_accessibility', 'structured_data_quality') - 14 / 12) < 1e-3);
  assert(Math.abs(ratio(wLate, 'bot_accessibility', 'structured_data_quality') - 14 / 12) < 1e-3);
  // Le poids absolu d'un sous-signal d'accessibilité décroît, celui du contenu croît.
  assert(wLate.bot_accessibility < w0.bot_accessibility);
  assert(wLate.content_quotability > w0.content_quotability);
});

Deno.test('GEO_PILLAR_REL : 10 sous-signaux uniques répartis 2 / 3 / 5', () => {
  assertEquals(Object.keys(GEO_PILLAR_REL.authority).length, 2);
  assertEquals(Object.keys(GEO_PILLAR_REL.accessibility).length, 3);
  assertEquals(Object.keys(GEO_PILLAR_REL.content).length, 5);
  const all = Object.values(GEO_PILLAR_REL).flatMap((r) => Object.keys(r));
  assertEquals(all.length, 10);
  assertEquals(new Set(all).size, 10, 'aucune clé dupliquée entre piliers');
});

// ─── Calibration par la citation réellement observée (±10 %) ───

const fullBreakdown = {
  brand_authority: 60,
  serp_presence: 60,
  bot_accessibility: 60,
  structured_data_quality: 60,
  content_freshness: 60,
  content_quotability: 60,
  answer_formatting: 60,
  knowledge_graph_signals: 60,
  self_citation_signals: 60,
  person_authority: 60,
};

Deno.test('calibration : citation observée haute majore le score, dans la limite de +10 %', () => {
  const base = buildGeoSubSignals({ breakdown: fullBreakdown, now: at('2026-08-23T00:00:00Z') });
  const up = buildGeoSubSignals({
    breakdown: fullBreakdown,
    observedCitation: { ratePct: 80, observations: 9 },
    now: at('2026-08-23T00:00:00Z'),
  });
  assert(up.citation_calibration.applied, 'calibration attendue');
  assertEquals(up.citation_calibration.factor_pct, GEO_CALIBRATION_MAX_PCT);
  assert(up.geo_score! > base.geo_score!, 'le score doit monter');
  assert(up.geo_score! <= Math.round(base.geo_score! * 1.1), 'majoration bornée à +10 %');
});

Deno.test('calibration : citation nulle applique la décote maximale et un plafond geo_citation', () => {
  const down = buildGeoSubSignals({
    breakdown: fullBreakdown,
    observedCitation: { ratePct: 0, observations: 9 },
    now: at('2026-08-23T00:00:00Z'),
  });
  assertEquals(down.citation_calibration.factor_pct, -GEO_CALIBRATION_MAX_PCT);
  assert(down.gates.some((g) => g.axis === 'geo_citation'), 'plafond geo_citation attendu');
});

Deno.test('calibration : échantillon trop court ou non mesuré ne change pas le score', () => {
  const base = buildGeoSubSignals({ breakdown: fullBreakdown, now: at('2026-08-23T00:00:00Z') });
  const short = buildGeoSubSignals({
    breakdown: fullBreakdown,
    observedCitation: { ratePct: 0, observations: GEO_CALIBRATION_MIN_OBSERVATIONS - 1 },
    now: at('2026-08-23T00:00:00Z'),
  });
  assertEquals(short.citation_calibration.applied, false);
  assertEquals(short.geo_score, base.geo_score);
  assertEquals(base.citation_calibration.applied, false);
});

Deno.test('calibration : cible neutre sans effet, score borné 0-100', () => {
  const neutral = buildGeoSubSignals({
    breakdown: fullBreakdown,
    observedCitation: { ratePct: GEO_CALIBRATION_NEUTRAL_PCT, observations: 12 },
    now: at('2026-08-23T00:00:00Z'),
  });
  assertEquals(neutral.citation_calibration.factor_pct, 0);
  assert(neutral.geo_score! >= 0 && neutral.geo_score! <= 100);
});
