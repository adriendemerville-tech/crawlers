import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

/**
 * Unit tests for the statistical functions used in calculate-serp-geo-correlation.
 * Tests Pearson, Spearman, toRanks, pValue, betaIncomplete, lgamma.
 * 
 * Run with: deno test supabase/functions/calculate-serp-geo-correlation/index.test.ts
 */

// ─── Import the functions by re-declaring them (Edge Functions can't be imported directly) ───

function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  if (den === 0) return null;
  return num / den;
}

function toRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
    i = j;
  }
  return ranks;
}

function spearman(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  return pearson(toRanks(x), toRanks(y));
}

function lgamma(z: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  }
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) x += coef[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaIncomplete(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;
  let f = 1, c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;
  for (let m = 1; m <= 200; m++) {
    let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= d * c;
    num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d;
    c = 1 + num / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    f *= d * c;
    if (Math.abs(d * c - 1) < 1e-8) break;
  }
  return front * f;
}

function pValue(r: number | null, n: number): number | null {
  if (r === null || n < 4) return null;
  const r2 = r * r;
  if (r2 >= 1) return 0;
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r2));
  const df = n - 2;
  return betaIncomplete(df / 2, 0.5, df / (df + t * t));
}

// ─── Tests ──────────────────────────────────────────────────────

Deno.test("pearson: perfect positive correlation", () => {
  const r = pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
  assertEquals(r, 1);
});

Deno.test("pearson: perfect negative correlation", () => {
  const r = pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
  assertEquals(r, -1);
});

Deno.test("pearson: zero correlation (orthogonal)", () => {
  // Symmetric pattern → r ≈ 0
  const r = pearson([1, 2, 3, 2, 1], [1, 0, 1, 0, 1]);
  assertAlmostEquals(r!, 0, 0.01);
});

Deno.test("pearson: too few points returns null", () => {
  assertEquals(pearson([1, 2], [3, 4]), null);
  assertEquals(pearson([], []), null);
});

Deno.test("pearson: constant array returns null", () => {
  assertEquals(pearson([5, 5, 5, 5], [1, 2, 3, 4]), null);
});

Deno.test("pearson: known value (hand-calculated)", () => {
  // x = [1,2,3,4,5], y = [2,4,5,4,5]
  // r ≈ 0.7746
  const r = pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
  assertAlmostEquals(r!, 0.7746, 0.001);
});

Deno.test("toRanks: basic ranking", () => {
  const ranks = toRanks([30, 10, 20]);
  assertEquals(ranks, [3, 1, 2]);
});

Deno.test("toRanks: handles ties with average rank", () => {
  const ranks = toRanks([10, 20, 20, 30]);
  assertEquals(ranks, [1, 2.5, 2.5, 4]);
});

Deno.test("toRanks: all equal values", () => {
  const ranks = toRanks([5, 5, 5]);
  assertEquals(ranks, [2, 2, 2]);
});

Deno.test("spearman: perfect monotonic (same as Pearson for linear)", () => {
  const r = spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
  assertAlmostEquals(r!, 1, 0.001);
});

Deno.test("spearman: non-linear but monotonic", () => {
  // y = x² → monotonic increasing → Spearman = 1
  const r = spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 25]);
  assertAlmostEquals(r!, 1, 0.001);
});

Deno.test("spearman: too few points returns null", () => {
  assertEquals(spearman([1], [2]), null);
});

Deno.test("lgamma: known values", () => {
  // lgamma(1) = 0 (0! = 1 → ln(1) = 0)
  assertAlmostEquals(lgamma(1), 0, 0.0001);
  // lgamma(2) = 0 (1! = 1 → ln(1) = 0)
  assertAlmostEquals(lgamma(2), 0, 0.0001);
  // lgamma(5) = ln(4!) = ln(24) ≈ 3.1781
  assertAlmostEquals(lgamma(5), Math.log(24), 0.0001);
  // lgamma(0.5) = ln(√π) ≈ 0.5724
  assertAlmostEquals(lgamma(0.5), Math.log(Math.sqrt(Math.PI)), 0.0001);
});

Deno.test("betaIncomplete: boundary values", () => {
  assertEquals(betaIncomplete(1, 1, 0), 0);
  assertEquals(betaIncomplete(1, 1, 1), 1);
});

Deno.test("betaIncomplete: known value I(0.5; 1, 1) = 0.5", () => {
  // For a=1, b=1: I(x;1,1) = x
  assertAlmostEquals(betaIncomplete(1, 1, 0.5), 0.5, 0.001);
  assertAlmostEquals(betaIncomplete(1, 1, 0.3), 0.3, 0.001);
});

Deno.test("pValue: null for insufficient data", () => {
  assertEquals(pValue(0.5, 3), null); // n < 4
  assertEquals(pValue(null, 10), null);
});

Deno.test("pValue: perfect correlation → p ≈ 0", () => {
  const p = pValue(1.0, 10);
  assertEquals(p, 0);
});

Deno.test("pValue: weak correlation + small n → high p", () => {
  const p = pValue(0.1, 5);
  // r=0.1 with n=5 → not significant → p should be >> 0.05
  assertEquals(p !== null && p > 0.05, true);
});

Deno.test("pValue: strong correlation + large n → low p", () => {
  const p = pValue(0.9, 30);
  // r=0.9 with n=30 → very significant → p should be << 0.01
  assertEquals(p !== null && p < 0.001, true);
});

Deno.test("pValue: moderate correlation threshold", () => {
  // r=0.7, n=10 → should be significant (p < 0.05)
  const p = pValue(0.7, 10);
  assertEquals(p !== null && p < 0.05, true);
});

Deno.test("end-to-end: realistic SEO data", () => {
  // Simulate: avg_position improving (lower is better) while LLM visibility increases
  const positions = [45, 42, 38, 35, 33, 30, 28, 25, 22, 20];
  const llmScores = [10, 12, 15, 18, 22, 25, 30, 35, 40, 45];

  const r = pearson(positions, llmScores);
  // Position decreasing while LLM increasing → strong negative Pearson
  assertEquals(r !== null && r < -0.95, true);

  const s = spearman(positions, llmScores);
  assertEquals(s !== null && s < -0.95, true);

  const p = pValue(r, positions.length);
  // Should be highly significant with 10 data points and r < -0.95
  assertEquals(p !== null && p < 0.001, true);
});
