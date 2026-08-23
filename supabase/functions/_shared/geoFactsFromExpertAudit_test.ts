import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  geoFactsFromExpertAudit,
  structuredDataFromExpert,
  crawlFormattingFromExpert,
  botShellFromExpert,
  quotabilityFromFacts,
  personAuthorityFromStrategic,
  type ExpertAuditFacts,
  type StrategicAuditFacts,
} from './geoFactsFromExpertAudit.ts';
import { buildGeoSubSignals } from './geoSubSignals.ts';

const NOW = new Date('2026-08-23T00:00:00Z');

const healthyExpert: ExpertAuditFacts = {
  scores: {
    aiReady: { score: 30, hasSchemaOrg: true, schemaTypes: ['Organization', 'Article', 'FAQPage', 'Person'], hasRobotsTxt: true, robotsPermissive: true, allowsAIBots: true },
    semantic: { wordCount: 1400, hasUniqueH1: true, h1Count: 1, hasTitle: true, hasMetaDesc: true },
  },
  htmlAnalysis: { wordCount: 1400, textRatioPct: 18, h1Count: 1, listCount: 6, hasSchemaOrg: true },
  insights: { faq: { contentPresent: true, schemaPresent: true }, freshness: { hasVisibleDate: true, ageDays: 40 } },
  meta: { renderingMode: 'static_fast' },
};

const strategic: StrategicAuditFacts = {
  llm_visibility: {
    citation_breakdown: {
      serp_presence: 62, structured_data_quality: 90, content_quotability: 78,
      brand_authority: 55, content_freshness: 70, business_intent_match: 60,
      self_citation_signals: 44, knowledge_graph_signals: 38,
    },
  },
  quotability: { score: 74 },
  summary_resilience: { score: 80 },
  social_signals: { thought_leadership: { founder_authority: 'high', eeat_score: 8 } },
};

Deno.test('données structurées : mesure sur le HTML servi, bonus FAQPage adossé', () => {
  const v = structuredDataFromExpert(healthyExpert);
  assert(v !== null && v >= 90, `attendu >= 90, reçu ${v}`);
});

Deno.test('données structurées : JSON-LD généré en JS et robots fermés font chuter le signal', () => {
  const v = structuredDataFromExpert({
    scores: { aiReady: { hasSchemaOrg: true, schemaTypes: ['Organization'], allowsAIBots: false } },
    insights: { jsonLdValidation: { isJsGenerated: true } },
  });
  assert(v !== null && v < 30, `attendu < 30, reçu ${v}`);
});

Deno.test('mise en forme : page unique projetée en ratios pagesAnalyzed = 1', () => {
  const c = crawlFormattingFromExpert(healthyExpert);
  assertEquals(c?.pagesAnalyzed, 1);
  assertEquals(c?.pagesWithH1, 1);
  assertEquals(c?.pagesWithFaq, 1);
  assertEquals(c?.pagesWithLists, 1);
  assertEquals(c?.avgWordCount, 1400);
});

Deno.test('mise en forme : finding no-faq-section vaut une absence de FAQ mesurée', () => {
  const c = crawlFormattingFromExpert({
    scores: { semantic: { wordCount: 800, hasUniqueH1: true } },
    insights: { findings: [{ id: 'no-faq-section' }] },
  });
  assertEquals(c?.pagesWithFaq, 0);
});

Deno.test('coquille JS : rendu dynamique seul ne suffit pas, dynamique + JSON-LD en JS oui', () => {
  assertEquals(botShellFromExpert({ meta: { renderingMode: 'dynamic_rendered' } }).isBotShell, null);
  assertEquals(
    botShellFromExpert({ meta: { renderingMode: 'dynamic_rendered' }, insights: { jsonLdValidation: { isJsGenerated: true } } }).isBotShell,
    true,
  );
  assertEquals(botShellFromExpert({ meta: { renderingMode: 'static_fast' } }).isBotShell, false);
  assertEquals(botShellFromExpert({ insights: { botRenderingShell: { isShell: true, botOnlyAbsences: 3 } } }), { isBotShell: true, botOnlyAbsences: 3 });
});

Deno.test('citabilité : le jugement LLM est minoré par le volume mesuré', () => {
  const thin: ExpertAuditFacts = { scores: { semantic: { wordCount: 120 } } };
  const r = quotabilityFromFacts(thin, strategic);
  assert(r.llmUsed);
  assertEquals(r.value, 30); // plafond de volume (100-249 mots) l'emporte sur ~77 LLM
});

Deno.test('citabilité : sans jugement LLM, estimation de volume seule', () => {
  const r = quotabilityFromFacts({ scores: { semantic: { wordCount: 1000 } } }, null);
  assertEquals(r.llmUsed, false);
  assertEquals(r.value, 100);
});

Deno.test('voix experte : founder_authority high + eeat 8 = résolue et corroborée', () => {
  assertEquals(personAuthorityFromStrategic(strategic), { resolved: true, corroborated: true });
  assertEquals(personAuthorityFromStrategic({ social_signals: { thought_leadership: { founder_authority: 'unknown' } } }), { resolved: false, corroborated: false });
  assertEquals(personAuthorityFromStrategic(null), { resolved: null, corroborated: null });
});

Deno.test('projection complète : les 10 sous-signaux sont alimentés et le GEO est calculable', () => {
  const { inputs, sources } = geoFactsFromExpertAudit(healthyExpert, strategic, { now: NOW });
  const report = buildGeoSubSignals(inputs);

  assertEquals(report.signals.length, 10);
  assertEquals(report.signals.filter((s) => s.value === null).length, 0);
  assert(report.geo_score !== null && report.geo_score > 50, `GEO attendu > 50, reçu ${report.geo_score}`);

  // Les piliers gardent le barème 25 / 22 / 53 à l'ancre.
  assertEquals(report.pillar_points, { authority: 25, accessibility: 22, content: 53 });

  // Provenance : mesure là où l'audit expert mesure, LLM ailleurs.
  assertEquals(sources['structured_data_quality'], 'expert_measure');
  assertEquals(sources['bot_accessibility'], 'expert_measure');
  assertEquals(sources['answer_formatting'], 'expert_measure');
  assertEquals(sources['content_freshness'], 'expert_measure');
  assertEquals(sources['serp_presence'], 'llm_judgement');
});

Deno.test('projection : autorité mesurée (backlinks) prime sur le jugement LLM', () => {
  const { inputs, sources } = geoFactsFromExpertAudit(
    healthyExpert,
    { ...strategic, domain_authority: { score: 31 } },
    { now: NOW },
  );
  assertEquals(inputs.breakdown?.['brand_authority'], 31);
  assertEquals(sources['brand_authority'], 'expert_measure');
});

Deno.test('projection : sans audit stratégique, les signaux hors site restent non mesurés', () => {
  const { inputs, sources } = geoFactsFromExpertAudit(healthyExpert, null, { now: NOW });
  assertEquals(inputs.breakdown?.['serp_presence'], null);
  assertEquals(sources['serp_presence'], 'unmeasured');
  const report = buildGeoSubSignals(inputs);
  assertEquals(report.authority.score, null); // pilier non couvert : exclu, pas mis à zéro
  assert(report.geo_score !== null);
});

Deno.test('projection : coquille JS déclenche les plafonds de cohérence du GEO', () => {
  const shellExpert: ExpertAuditFacts = {
    ...healthyExpert,
    scores: { ...healthyExpert.scores, semantic: { wordCount: 40, hasUniqueH1: true, h1Count: 1 } },
    htmlAnalysis: { wordCount: 40, textRatioPct: 1.2, h1Count: 1, listCount: 0, hasSchemaOrg: true },
    insights: { ...healthyExpert.insights, botRenderingShell: { isShell: true, botOnlyAbsences: 4 } },
  };
  const { inputs } = geoFactsFromExpertAudit(shellExpert, strategic, { now: NOW });
  const report = buildGeoSubSignals(inputs);
  assert(report.gates.length > 0, 'des plafonds doivent être appliqués');
  const quot = report.signals.find((s) => s.key === 'content_quotability')!;
  assert(quot.value !== null && quot.value <= 15, `citabilité attendue <= 15, reçue ${quot.value}`);
});

Deno.test('projection : ratio de texte accepté en fraction (0-1) comme en pourcentage', () => {
  const a = geoFactsFromExpertAudit({ htmlAnalysis: { wordCount: 500, textRatio: 0.14 } }).inputs.textRatioPct;
  const b = geoFactsFromExpertAudit({ htmlAnalysis: { wordCount: 500, textRatioPct: 14 } }).inputs.textRatioPct;
  assertEquals(a, 14);
  assertEquals(b, 14);
});

Deno.test('projection : TTFB lent décote l’accessibilité robots sans changer le barème', () => {
  const fast = geoFactsFromExpertAudit({ ...healthyExpert, performance: { ttfb: 320 } }, strategic, { now: NOW });
  const slow = geoFactsFromExpertAudit({ ...healthyExpert, performance: { ttfb: 3200 } }, strategic, { now: NOW });
  const sig = (p: typeof fast) => buildGeoSubSignals(p.inputs).signals.find((s) => s.key === 'bot_accessibility')!.value;
  const vFast = sig(fast);
  const vSlow = sig(slow);
  assert(vFast !== null && vSlow !== null);
  assertEquals(vSlow, (vFast as number) - 25);
  // Le barème des piliers reste inchangé.
  const wFast = buildGeoSubSignals(fast.inputs).weights.accessibility;
  const wSlow = buildGeoSubSignals(slow.inputs).weights.accessibility;
  assertEquals(wFast, wSlow);
});

Deno.test('projection : TTFB non mesuré ne fabrique aucun défaut', () => {
  const a = buildGeoSubSignals(geoFactsFromExpertAudit(healthyExpert, strategic, { now: NOW }).inputs);
  const b = buildGeoSubSignals(geoFactsFromExpertAudit({ ...healthyExpert, performance: { ttfb: 400 } }, strategic, { now: NOW }).inputs);
  assertEquals(a.geo_score, b.geo_score);
});
