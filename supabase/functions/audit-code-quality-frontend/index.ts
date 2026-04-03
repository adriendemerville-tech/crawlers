import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

/**
 * audit-code-quality-frontend — Analyse la qualité du code front-end (React/TypeScript)
 * 
 * POST { files: Array<{ name: string, content: string }> }
 * Returns: score /100 avec détails par critère
 * 
 * Critères: Architecture /20, Design System /20, TypeScript /15, Performance /15, Accessibilité /10, SEO /10, Tests /10
 */

interface FileEntry { name: string; content: string }

interface CriterionResult {
  score: number;
  maxScore: number;
  details: string[];
  warnings: string[];
}

function auditArchitecture(files: FileEntry[]): CriterionResult {
  const MAX = 20;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];

  let oversizedComponents = 0;
  let componentsWithLogic = 0;
  let hooksCount = 0;
  let totalLines = 0;
  let maxLines = 0;
  let maxFileName = '';

  const components = files.filter(f => /\.(tsx|jsx)$/.test(f.name) && !/\.test\.|\.spec\./.test(f.name));
  const hooks = files.filter(f => /use[A-Z]/.test(f.name) && /\.(ts|tsx)$/.test(f.name));
  hooksCount = hooks.length;

  for (const f of components) {
    const lines = f.content.split('\n').length;
    totalLines += lines;
    if (lines > maxLines) { maxLines = lines; maxFileName = f.name; }
    if (lines > 300) oversizedComponents++;
    // Business logic in components (fetch/supabase/complex state)
    if (/supabase\.|\.from\(|fetch\(/.test(f.content) && !/use[A-Z]\w+/.test(f.name)) componentsWithLogic++;
  }

  const avgLines = components.length > 0 ? Math.round(totalLines / components.length) : 0;
  details.push(`Components: ${components.length}, Hooks: ${hooksCount}`);
  details.push(`Average component size: ${avgLines} lines`);
  details.push(`Largest: ${maxFileName} (${maxLines} lines)`);
  details.push(`Oversized (>300 lines): ${oversizedComponents}`);

  const hookRatio = components.length > 0 ? hooksCount / components.length : 0;
  if (hookRatio < 0.1) { score -= 5; warnings.push('Very few custom hooks — logic may not be separated from UI'); }
  if (oversizedComponents > components.length * 0.2) { score -= 6; warnings.push(`${oversizedComponents} components exceed 300 lines`); }
  if (componentsWithLogic > components.length * 0.3) { score -= 4; warnings.push(`${componentsWithLogic} components contain direct data-fetching logic`); }
  if (maxLines > 500) { score -= 3; warnings.push(`${maxFileName} has ${maxLines} lines — split into sub-components`); }

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditDesignSystem(files: FileEntry[]): CriterionResult {
  const MAX = 20;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];

  let hardcodedColors = 0;
  let usingTokens = 0;
  let usingShadcn = 0;
  let hardcodedColorFiles: string[] = [];

  const components = files.filter(f => /\.(tsx|jsx)$/.test(f.name));

  for (const f of components) {
    const c = f.content;
    // Hardcoded colors: text-white, bg-black, text-red-500, bg-[#xxx], etc. (not in comments)
    const hardcoded = (c.match(/(?:text|bg|border|ring|fill|stroke)-(?:white|black|red|blue|green|yellow|purple|pink|orange|gray|slate|zinc|neutral|stone|amber|lime|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose)-\d{2,3}/g) || []).length;
    const hexColors = (c.match(/bg-\[#[0-9a-fA-F]+\]|text-\[#[0-9a-fA-F]+\]/g) || []).length;
    if (hardcoded + hexColors > 3) { hardcodedColors++; hardcodedColorFiles.push(f.name); }
    // Using semantic tokens
    if (/text-(?:primary|secondary|muted|accent|foreground|destructive)|bg-(?:primary|secondary|muted|accent|background|card|popover)/.test(c)) usingTokens++;
    // Using shadcn
    if (/@\/components\/ui\//.test(c)) usingShadcn++;
  }

  const total = components.length;
  details.push(`Semantic tokens used: ${usingTokens}/${total} components`);
  details.push(`Shadcn imports: ${usingShadcn}/${total} components`);
  details.push(`Hardcoded color violations: ${hardcodedColors} files`);

  if (hardcodedColors > total * 0.3) { score -= 8; warnings.push(`${hardcodedColors} files use hardcoded colors — use design tokens`); }
  else if (hardcodedColors > 5) { score -= 4; warnings.push(`${hardcodedColors} files with hardcoded colors`); }
  if (hardcodedColorFiles.length > 0) details.push(`Worst offenders: ${hardcodedColorFiles.slice(0, 5).join(', ')}`);

  const tokenRate = total > 0 ? usingTokens / total : 0;
  if (tokenRate < 0.3) { score -= 5; warnings.push(`Only ${Math.round(tokenRate * 100)}% components use semantic tokens`); }
  
  const shadcnRate = total > 0 ? usingShadcn / total : 0;
  if (shadcnRate < 0.3) { score -= 3; warnings.push('Low shadcn/ui usage — inconsistent component patterns'); }

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditTypeScript(files: FileEntry[]): CriterionResult {
  const MAX = 15;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];

  let anyCount = 0;
  let tsFiles = 0;
  let withExplicitTypes = 0;
  let withZod = 0;
  const anyOffenders: string[] = [];

  for (const f of files) {
    if (!/\.(ts|tsx)$/.test(f.name)) continue;
    tsFiles++;
    const c = f.content;
    const anyMatches = (c.match(/:\s*any\b|as\s+any\b|<any>/g) || []).length;
    if (anyMatches > 0) { anyCount += anyMatches; if (anyMatches > 3) anyOffenders.push(`${f.name}(${anyMatches})`); }
    if (/:\s*(?:string|number|boolean|Record|Array|interface\s|type\s)/.test(c)) withExplicitTypes++;
    if (/zod|\.parse\(|z\./.test(c)) withZod++;
  }

  details.push(`TypeScript files: ${tsFiles}`);
  details.push(`Explicit typing: ${withExplicitTypes}/${tsFiles}`);
  details.push(`'any' usage count: ${anyCount}`);
  details.push(`Zod validation: ${withZod} files`);

  if (anyCount > 50) { score -= 8; warnings.push(`${anyCount} uses of 'any' — weak type safety`); }
  else if (anyCount > 20) { score -= 4; warnings.push(`${anyCount} uses of 'any' — could be stricter`); }
  if (anyOffenders.length > 0) details.push(`Worst 'any' offenders: ${anyOffenders.slice(0, 5).join(', ')}`);

  if (withZod < 3) { score -= 3; warnings.push('Very little runtime validation (zod)'); }

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditPerformance(files: FileEntry[]): CriterionResult {
  const MAX = 15;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];

  let lazyRoutes = 0;
  let useMemoCount = 0;
  let useCallbackCount = 0;
  let reactQueryCount = 0;
  let heavyReRenderRisk = 0;

  for (const f of files) {
    const c = f.content;
    if (/React\.lazy|lazy\(/.test(c)) lazyRoutes++;
    if (/useMemo/.test(c)) useMemoCount++;
    if (/useCallback/.test(c)) useCallbackCount++;
    if (/useQuery|useMutation|@tanstack/.test(c)) reactQueryCount++;
    // Heavy re-render risk: inline objects/arrays in JSX props
    if (/style=\{\{/.test(c) || /={{[\s\S]*?}}/.test(c)) heavyReRenderRisk++;
  }

  details.push(`Lazy loading routes: ${lazyRoutes}`);
  details.push(`useMemo: ${useMemoCount}, useCallback: ${useCallbackCount}`);
  details.push(`React Query usage: ${reactQueryCount} files`);
  details.push(`Inline object/style risk: ${heavyReRenderRisk} files`);

  if (lazyRoutes < 3) { score -= 5; warnings.push('Few lazy-loaded routes — large initial bundle'); }
  if (useMemoCount + useCallbackCount < 10) { score -= 3; warnings.push('Limited memoization usage'); }
  if (reactQueryCount < 5) { score -= 3; warnings.push('Low React Query adoption — may have manual fetch patterns'); }
  if (heavyReRenderRisk > 20) { score -= 4; warnings.push(`${heavyReRenderRisk} files with inline styles/objects in JSX`); }

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditAccessibility(files: FileEntry[]): CriterionResult {
  const MAX = 10;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];

  let withAlt = 0;
  let withAria = 0;
  let imgWithoutAlt = 0;
  let withKeyboard = 0;

  const components = files.filter(f => /\.(tsx|jsx)$/.test(f.name));

  for (const f of components) {
    const c = f.content;
    if (/alt=/.test(c)) withAlt++;
    if (/aria-/.test(c)) withAria++;
    if (/<img\b(?![^>]*alt=)/.test(c)) imgWithoutAlt++;
    if (/onKeyDown|onKeyPress|onKeyUp|tabIndex|role=/.test(c)) withKeyboard++;
  }

  const total = components.length;
  details.push(`Alt attributes: ${withAlt} components`);
  details.push(`ARIA usage: ${withAria} components`);
  details.push(`Keyboard handlers: ${withKeyboard} components`);
  details.push(`Images without alt: ${imgWithoutAlt} files`);

  if (imgWithoutAlt > 3) { score -= 4; warnings.push(`${imgWithoutAlt} files contain <img> without alt`); }
  if (withAria < total * 0.1) { score -= 3; warnings.push('Very few ARIA attributes'); }
  if (withKeyboard < 5) { score -= 3; warnings.push('Limited keyboard navigation support'); }

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditSEO(files: FileEntry[]): CriterionResult {
  const MAX = 10;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];

  let withHelmet = 0;
  let withSemanticHTML = 0;
  let withJsonLD = 0;
  let withH1 = 0;

  for (const f of files) {
    const c = f.content;
    if (/Helmet|react-helmet|useHead/.test(c)) withHelmet++;
    if (/<(main|article|section|nav|header|footer|aside)\b/.test(c)) withSemanticHTML++;
    if (/application\/ld\+json|JSON-LD|jsonLd/.test(c)) withJsonLD++;
    if (/<h1\b/.test(c)) withH1++;
  }

  details.push(`Meta tags (Helmet): ${withHelmet} files`);
  details.push(`Semantic HTML: ${withSemanticHTML} files`);
  details.push(`JSON-LD schema: ${withJsonLD} files`);
  details.push(`H1 usage: ${withH1} files`);

  if (withHelmet < 3) { score -= 4; warnings.push('Very few pages set meta tags'); }
  if (withJsonLD < 1) { score -= 3; warnings.push('No JSON-LD structured data found'); }
  if (withSemanticHTML < 5) { score -= 3; warnings.push('Limited semantic HTML usage'); }

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditTests(files: FileEntry[]): CriterionResult {
  const MAX = 10;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];

  const testFiles = files.filter(f => /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(f.name));
  const components = files.filter(f => /\.(tsx|jsx)$/.test(f.name) && !/\.(test|spec)\./.test(f.name));

  const coverage = components.length > 0 ? testFiles.length / components.length : 0;
  details.push(`Test files: ${testFiles.length}`);
  details.push(`Coverage ratio: ${Math.round(coverage * 100)}% (${testFiles.length}/${components.length} components)`);

  if (coverage < 0.05) { score -= 10; warnings.push('Almost no test coverage'); }
  else if (coverage < 0.15) { score -= 7; warnings.push(`Very low coverage: ${Math.round(coverage * 100)}%`); }
  else if (coverage < 0.4) { score -= 4; warnings.push(`Moderate coverage: ${Math.round(coverage * 100)}%`); }

  // Quality check
  let withRTL = 0;
  for (const t of testFiles) {
    if (/render|screen|fireEvent|userEvent|@testing-library/.test(t.content)) withRTL++;
  }
  if (testFiles.length > 0) details.push(`Using React Testing Library: ${withRTL}/${testFiles.length}`);

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

Deno.serve(handleRequest(async (req) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!auth.isAdmin) return jsonError('Admin only', 403);

  const { files } = await req.json() as { files: FileEntry[] };
  if (!files || !Array.isArray(files)) return jsonError('files[] required');

  const architecture = auditArchitecture(files);
  const designSystem = auditDesignSystem(files);
  const typescript = auditTypeScript(files);
  const performance = auditPerformance(files);
  const accessibility = auditAccessibility(files);
  const seo = auditSEO(files);
  const tests = auditTests(files);

  const totalScore = architecture.score + designSystem.score + typescript.score + performance.score + accessibility.score + seo.score + tests.score;
  const maxTotal = architecture.maxScore + designSystem.maxScore + typescript.maxScore + performance.maxScore + accessibility.maxScore + seo.maxScore + tests.maxScore;

  const allWarnings = [
    ...architecture.warnings.map(w => `[Architecture] ${w}`),
    ...designSystem.warnings.map(w => `[Design System] ${w}`),
    ...typescript.warnings.map(w => `[TypeScript] ${w}`),
    ...performance.warnings.map(w => `[Performance] ${w}`),
    ...accessibility.warnings.map(w => `[Accessibilité] ${w}`),
    ...seo.warnings.map(w => `[SEO] ${w}`),
    ...tests.warnings.map(w => `[Tests] ${w}`),
  ];

  let grade: string;
  if (totalScore >= 90) grade = 'A';
  else if (totalScore >= 80) grade = 'B';
  else if (totalScore >= 65) grade = 'C';
  else if (totalScore >= 50) grade = 'D';
  else grade = 'F';

  return jsonOk({
    totalScore,
    maxScore: maxTotal,
    grade,
    filesAnalyzed: files.length,
    criteria: { architecture, designSystem, typescript, performance, accessibility, seo, tests },
    topWarnings: allWarnings.slice(0, 10),
    auditedAt: new Date().toISOString(),
  });
}));
