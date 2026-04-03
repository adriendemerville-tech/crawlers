import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';

/**
 * audit-code-quality-backend — Analyse la qualité du code back-end (Edge Functions)
 * 
 * POST { files: Array<{ name: string, content: string }> }
 * Returns: score /100 avec détails par critère
 * 
 * Critères: Sécurité /25, Fiabilité /20, Factorisation /20, Performance /15, Maintenabilité /10, Tests /10
 */

interface FileEntry { name: string; content: string }

interface CriterionResult {
  score: number;
  maxScore: number;
  details: string[];
  warnings: string[];
}

function auditSecurity(files: FileEntry[]): CriterionResult {
  const MAX = 25;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];
  const total = files.length;
  if (total === 0) return { score: 0, maxScore: MAX, details: ['No files provided'], warnings: [] };

  let withAuth = 0;
  let withInputValidation = 0;
  let withHardcodedSecrets = 0;
  let withSSRF = 0;
  let withCORS = 0;

  for (const f of files) {
    const c = f.content;
    // Auth check
    if (/getAuthenticatedUser|auth\.getUser|Authorization|getAuthenticatedUserId/.test(c)) withAuth++;
    // Input validation
    if (/typeof\s+\w+\s*[!=]==|![\w.]+\s*\|\||\.trim\(\)|zod|\.parse\(|required|if\s*\(\s*!\w+/.test(c)) withInputValidation++;
    // Hardcoded secrets (API keys, passwords in code)
    if (/['"][A-Za-z0-9]{32,}['"]/.test(c) && !/Bearer |Basic /.test(c) && !/Deno\.env/.test(c)) withHardcodedSecrets++;
    // SSRF protection
    if (/assertSafeUrl|BLOCKED_HOSTS/.test(c)) withSSRF++;
    // CORS
    if (/corsHeaders|cors/.test(c)) withCORS++;
  }

  const authRate = withAuth / total;
  if (authRate < 0.5) { score -= 10; warnings.push(`Only ${Math.round(authRate * 100)}% functions have auth checks`); }
  else if (authRate < 0.8) { score -= 5; warnings.push(`${Math.round(authRate * 100)}% functions have auth — aim for 80%+`); }
  details.push(`Auth coverage: ${withAuth}/${total} (${Math.round(authRate * 100)}%)`);

  const validRate = withInputValidation / total;
  if (validRate < 0.5) { score -= 5; warnings.push(`Low input validation: ${Math.round(validRate * 100)}%`); }
  details.push(`Input validation: ${withInputValidation}/${total} (${Math.round(validRate * 100)}%)`);

  if (withHardcodedSecrets > 0) { score -= 8; warnings.push(`${withHardcodedSecrets} file(s) may contain hardcoded secrets`); }
  details.push(`Hardcoded secrets detected: ${withHardcodedSecrets}`);

  const corsRate = withCORS / total;
  if (corsRate < 0.9) { score -= 2; warnings.push(`CORS headers missing in ${total - withCORS} functions`); }
  details.push(`CORS coverage: ${withCORS}/${total}`);

  // SSRF protection is bonus
  if (withSSRF > 0) details.push(`SSRF protection: ${withSSRF} function(s)`);

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditReliability(files: FileEntry[]): CriterionResult {
  const MAX = 20;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];
  const total = files.length;
  if (total === 0) return { score: 0, maxScore: MAX, details: [], warnings: [] };

  let withTryCatch = 0;
  let withProperStatus = 0;
  let withLogging = 0;
  let withTimeout = 0;

  for (const f of files) {
    const c = f.content;
    if (/try\s*\{/.test(c)) withTryCatch++;
    if (/status:\s*(4\d{2}|5\d{2})/.test(c) || /jsonError/.test(c)) withProperStatus++;
    if (/console\.(error|warn|log)\(/.test(c)) withLogging++;
    if (/AbortController|setTimeout|timeout/.test(c)) withTimeout++;
  }

  const tryCatchRate = withTryCatch / total;
  if (tryCatchRate < 0.8) { score -= 8; warnings.push(`Try/catch in only ${Math.round(tryCatchRate * 100)}% of functions`); }
  details.push(`Error handling: ${withTryCatch}/${total} (${Math.round(tryCatchRate * 100)}%)`);

  const statusRate = withProperStatus / total;
  if (statusRate < 0.7) { score -= 5; warnings.push(`Proper HTTP status codes in only ${Math.round(statusRate * 100)}%`); }
  details.push(`HTTP status handling: ${withProperStatus}/${total}`);

  const logRate = withLogging / total;
  if (logRate < 0.6) { score -= 4; warnings.push(`Structured logging in only ${Math.round(logRate * 100)}%`); }
  details.push(`Logging: ${withLogging}/${total}`);

  details.push(`Timeout handling: ${withTimeout}/${total}`);
  if (withTimeout < total * 0.3) { score -= 3; warnings.push('Few functions implement timeouts for external calls'); }

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditFactorization(files: FileEntry[]): CriterionResult {
  const MAX = 20;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];
  const total = files.length;
  if (total === 0) return { score: 0, maxScore: MAX, details: [], warnings: [] };

  let usingSharedHandler = 0;
  let usingSharedAuth = 0;
  let usingSharedClient = 0;
  let duplicatedCORS = 0;
  let inlineAuthBoilerplate = 0;

  for (const f of files) {
    const c = f.content;
    if (/from ['"]\.\.\/\_shared\/serveHandler/.test(c) || /handleRequest/.test(c)) usingSharedHandler++;
    if (/from ['"]\.\.\/\_shared\/auth/.test(c) || /getAuthenticatedUser/.test(c)) usingSharedAuth++;
    if (/from ['"]\.\.\/\_shared\/supabaseClient/.test(c)) usingSharedClient++;
    // Inline CORS boilerplate (not using shared)
    if (/Access-Control-Allow/.test(c) && !/from ['"]\.\.\/\_shared\/cors/.test(c)) duplicatedCORS++;
    // Inline auth boilerplate instead of shared
    if (/supabase\.auth\.getUser\(token\)/.test(c) && !/from ['"]\.\.\/\_shared\/auth/.test(c)) inlineAuthBoilerplate++;
  }

  const sharedRate = (usingSharedHandler + usingSharedAuth + usingSharedClient) / (total * 3);
  details.push(`Shared imports: handler=${usingSharedHandler}, auth=${usingSharedAuth}, client=${usingSharedClient}`);

  if (usingSharedHandler < total * 0.5) { score -= 6; warnings.push(`Only ${usingSharedHandler}/${total} use serveHandler — many have duplicated boilerplate`); }
  if (usingSharedAuth < total * 0.3) { score -= 4; warnings.push(`Only ${usingSharedAuth}/${total} use shared auth — inline auth patterns detected`); }
  if (duplicatedCORS > 5) { score -= 3; warnings.push(`${duplicatedCORS} functions define CORS inline instead of importing`); }
  if (inlineAuthBoilerplate > 5) { score -= 4; warnings.push(`${inlineAuthBoilerplate} functions use inline auth instead of getAuthenticatedUser()`); }

  details.push(`Inline CORS: ${duplicatedCORS}, Inline auth: ${inlineAuthBoilerplate}`);

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditPerformance(files: FileEntry[]): CriterionResult {
  const MAX = 15;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];
  const total = files.length;
  if (total === 0) return { score: 0, maxScore: MAX, details: [], warnings: [] };

  let withPromiseAll = 0;
  let withCache = 0;
  let potentialN1 = 0;
  let withPagination = 0;

  for (const f of files) {
    const c = f.content;
    if (/Promise\.all/.test(c)) withPromiseAll++;
    if (/audit_cache|cache|domain_data_cache|Cache/.test(c)) withCache++;
    // Potential N+1: for loop with await fetch/select inside
    if (/for\s*\([\s\S]*?await\s+(fetch|supabase)/.test(c) || /\.forEach[\s\S]*?await/.test(c)) potentialN1++;
    if (/\.range\(|limit|LIMIT|\.limit\(/.test(c)) withPagination++;
  }

  details.push(`Parallel queries (Promise.all): ${withPromiseAll}/${total}`);
  details.push(`Caching patterns: ${withCache}/${total}`);
  details.push(`Pagination/limits: ${withPagination}/${total}`);
  details.push(`Potential N+1 patterns: ${potentialN1}`);

  if (withPromiseAll < total * 0.15) { score -= 5; warnings.push('Very few functions parallelize independent queries'); }
  if (potentialN1 > 3) { score -= 5; warnings.push(`${potentialN1} potential N+1 query patterns detected`); }
  if (withCache < 3) { score -= 3; warnings.push('Limited caching — consider caching expensive operations'); }

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditMaintainability(files: FileEntry[]): CriterionResult {
  const MAX = 10;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];

  let oversizedFiles = 0;
  let totalLines = 0;
  let maxLines = 0;
  let maxFileName = '';

  for (const f of files) {
    const lines = f.content.split('\n').length;
    totalLines += lines;
    if (lines > maxLines) { maxLines = lines; maxFileName = f.name; }
    if (lines > 200) oversizedFiles++;
  }

  const avgLines = files.length > 0 ? Math.round(totalLines / files.length) : 0;
  details.push(`Average function size: ${avgLines} lines`);
  details.push(`Largest: ${maxFileName} (${maxLines} lines)`);
  details.push(`Oversized (>200 lines): ${oversizedFiles}/${files.length}`);

  if (oversizedFiles > files.length * 0.3) { score -= 5; warnings.push(`${oversizedFiles} functions exceed 200 lines — consider splitting`); }
  if (maxLines > 500) { score -= 3; warnings.push(`${maxFileName} has ${maxLines} lines — too complex`); }
  if (avgLines > 150) { score -= 2; warnings.push(`Average ${avgLines} lines — functions could be leaner`); }

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

function auditTests(files: FileEntry[], testFiles: FileEntry[]): CriterionResult {
  const MAX = 10;
  let score = MAX;
  const details: string[] = [];
  const warnings: string[] = [];
  const total = files.length;

  const testCount = testFiles.length;
  const coverage = total > 0 ? testCount / total : 0;

  details.push(`Test files found: ${testCount}`);
  details.push(`Coverage ratio: ${testCount}/${total} functions (${Math.round(coverage * 100)}%)`);

  if (coverage < 0.05) { score -= 10; warnings.push('Almost no test coverage'); }
  else if (coverage < 0.2) { score -= 7; warnings.push(`Very low test coverage: ${Math.round(coverage * 100)}%`); }
  else if (coverage < 0.5) { score -= 4; warnings.push(`Moderate test coverage: ${Math.round(coverage * 100)}%`); }

  // Check test quality
  let withAssertions = 0;
  let withErrorCases = 0;
  for (const t of testFiles) {
    if (/assert|expect|assertEquals/.test(t.content)) withAssertions++;
    if (/error|fail|invalid|unauthorized|403|401|500/.test(t.content)) withErrorCases++;
  }
  if (testCount > 0) {
    details.push(`Tests with assertions: ${withAssertions}/${testCount}`);
    details.push(`Tests covering error cases: ${withErrorCases}/${testCount}`);
  }

  return { score: Math.max(0, score), maxScore: MAX, details, warnings };
}

Deno.serve(handleRequest(async (req) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return jsonError('Unauthorized', 401);
  if (!auth.isAdmin) return jsonError('Admin only', 403);

  const { files, testFiles } = await req.json() as { files: FileEntry[]; testFiles?: FileEntry[] };
  if (!files || !Array.isArray(files)) return jsonError('files[] required');

  const security = auditSecurity(files);
  const reliability = auditReliability(files);
  const factorization = auditFactorization(files);
  const performance = auditPerformance(files);
  const maintainability = auditMaintainability(files);
  const tests = auditTests(files, testFiles || []);

  const totalScore = security.score + reliability.score + factorization.score + performance.score + maintainability.score + tests.score;
  const maxTotal = security.maxScore + reliability.maxScore + factorization.maxScore + performance.maxScore + maintainability.maxScore + tests.maxScore;

  const allWarnings = [
    ...security.warnings.map(w => `[Sécurité] ${w}`),
    ...reliability.warnings.map(w => `[Fiabilité] ${w}`),
    ...factorization.warnings.map(w => `[Factorisation] ${w}`),
    ...performance.warnings.map(w => `[Performance] ${w}`),
    ...maintainability.warnings.map(w => `[Maintenabilité] ${w}`),
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
    testFilesAnalyzed: testFiles?.length || 0,
    criteria: { security, reliability, factorization, performance, maintainability, tests },
    topWarnings: allWarnings.slice(0, 10),
    auditedAt: new Date().toISOString(),
  });
}));
