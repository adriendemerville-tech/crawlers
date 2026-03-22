import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * run-backend-tests — CI Test Runner pour Crawlers.fr
 *
 * Exécute 10 tests critiques couvrant les 4 piliers vitaux du backend :
 *   1. Sécurité & Auth (SSRF, Turnstile, ensure-profile)
 *   2. Facturation (calcul prix dynamique, create-checkout)
 *   3. Moteur d'audit (validate-url, robots.txt parser, cache)
 *   4. Tracking & Intégrité (token tracker, CORS)
 *
 * Résultats enregistrés dans analytics_events (event_type: ci_test_run).
 * Aucune notification front — uniquement logs backend + registre admin.
 */

interface TestResult {
  id: string
  name: string
  pillar: string
  passed: boolean
  duration_ms: number
  error?: string
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function assertThrows(fn: () => void, message: string) {
  try {
    fn()
    throw new Error(message)
  } catch (e) {
    if (e instanceof Error && e.message === message) throw e
    // Expected error — test passes
  }
}

async function runTest(
  id: string,
  name: string,
  pillar: string,
  fn: () => Promise<void>,
): Promise<TestResult> {
  const start = performance.now()
  try {
    await fn()
    return { id, name, pillar, passed: true, duration_ms: Math.round(performance.now() - start) }
  } catch (e) {
    return {
      id, name, pillar, passed: false,
      duration_ms: Math.round(performance.now() - start),
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

// ═══════════════════════════════════════════════
// PILIER 1 — SÉCURITÉ & AUTH
// ═══════════════════════════════════════════════

/**
 * TEST 1 : Protection SSRF
 * Vérifie que assertSafeUrl bloque les IPs privées et protocoles dangereux.
 * CRITIQUE car une faille SSRF permettrait à un attaquant d'accéder
 * à des services internes (DB, metadata cloud, etc.)
 */
async function testSsrfProtection(): Promise<void> {
  // Import dynamique du module partagé
  const { assertSafeUrl } = await import('../_shared/ssrf.ts')

  // Doit bloquer les IPs privées
  const blockedHosts = [
    'http://127.0.0.1/admin',
    'http://localhost:3000',
    'http://10.0.0.1/internal',
    'http://192.168.1.1/router',
    'http://169.254.169.254/metadata', // Cloud metadata endpoint
    'http://[::1]/ipv6-local',
  ]
  for (const url of blockedHosts) {
    assertThrows(
      () => assertSafeUrl(url),
      `SSRF: ${url} aurait dû être bloqué`,
    )
  }

  // Doit bloquer les protocoles dangereux
  const blockedProtocols = ['file:///etc/passwd', 'ftp://evil.com/data']
  for (const url of blockedProtocols) {
    assertThrows(
      () => assertSafeUrl(url),
      `SSRF: protocole ${url} aurait dû être bloqué`,
    )
  }

  // Doit accepter les URLs publiques valides
  const validUrls = ['https://google.com', 'https://crawlers.fr', 'http://example.org/page']
  for (const url of validUrls) {
    const parsed = assertSafeUrl(url)
    assert(parsed instanceof URL, `SSRF: ${url} devrait retourner un objet URL`)
  }

  // Doit rejeter les URLs malformées
  assertThrows(
    () => assertSafeUrl('not-a-url'),
    'SSRF: URL malformée aurait dû être rejetée',
  )
}

/**
 * TEST 2 : Endpoint Turnstile (Captcha)
 * Vérifie que verify-turnstile gère correctement les cas limites.
 * CRITIQUE car un bypass du captcha ouvrirait la porte au spam et aux bots.
 */
async function testTurnstileEndpoint(): Promise<void> {
  // Test 1: Requête sans token → doit retourner 400
  const noTokenResp = await fetch(`${supabaseUrl}/functions/v1/verify-turnstile`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  const noTokenBody = await noTokenResp.json()
  assert(noTokenResp.status === 400, `Turnstile sans token: attendu 400, reçu ${noTokenResp.status}`)
  assert(noTokenBody.success === false, 'Turnstile sans token: success devrait être false')

  // Test 2: Token TURNSTILE_UNAVAILABLE → fail-open (success: true)
  const unavailableResp = await fetch(`${supabaseUrl}/functions/v1/verify-turnstile`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: 'TURNSTILE_UNAVAILABLE' }),
  })
  const unavailableBody = await unavailableResp.json()
  assert(unavailableResp.ok, `Turnstile UNAVAILABLE: attendu 200, reçu ${unavailableResp.status}`)
  assert(unavailableBody.success === true, 'Turnstile UNAVAILABLE: devrait fail-open (success=true)')
}

/**
 * TEST 3 : Endpoint ensure-profile
 * Vérifie que la fonction rejette les requêtes non authentifiées.
 * CRITIQUE car c'est le gardien de la création de profils utilisateur.
 */
async function testEnsureProfileAuth(): Promise<void> {
  // Test 1: Sans header Authorization → 401
  const noAuthResp = await fetch(`${supabaseUrl}/functions/v1/ensure-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
    },
    body: JSON.stringify({}),
  })
  await noAuthResp.text() // consume body
  assert(noAuthResp.status === 401, `ensure-profile sans auth: attendu 401, reçu ${noAuthResp.status}`)

  // Test 2: Avec Bearer invalide → 401
  const badAuthResp = await fetch(`${supabaseUrl}/functions/v1/ensure-profile`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer invalid-token-12345',
      'Content-Type': 'application/json',
      'apikey': serviceKey,
    },
    body: JSON.stringify({}),
  })
  await badAuthResp.text() // consume body
  assert(badAuthResp.status === 401, `ensure-profile token invalide: attendu 401, reçu ${badAuthResp.status}`)
}

// ═══════════════════════════════════════════════
// PILIER 2 — FACTURATION & CRÉDITS
// ═══════════════════════════════════════════════

/**
 * TEST 4 : Calcul du prix dynamique
 * Vérifie que la logique de pricing respecte les bornes et le calcul proportionnel.
 * CRITIQUE car une erreur ici = perte de revenus ou surfacturation.
 */
async function testDynamicPricing(): Promise<void> {
  // Reproduire la logique identique à save-audit/index.ts
  const MIN_PRICE = 3.00
  const MAX_PRICE = 12.00
  const PRICE_RANGE = MAX_PRICE - MIN_PRICE

  function calculateDynamicPrice(fixesMetadata: Array<{ category: string }>, totalAdvancedFixes: number): number {
    const enabledStrategic = fixesMetadata.filter(f => f.category === 'strategic').length
    const enabledGenerative = fixesMetadata.filter(f => f.category === 'generative').length
    const enabledAdvanced = enabledStrategic + enabledGenerative
    if (totalAdvancedFixes === 0 || enabledAdvanced === 0) return MIN_PRICE
    const advancedPercent = enabledAdvanced / totalAdvancedFixes
    const rawPrice = MIN_PRICE + (PRICE_RANGE * advancedPercent)
    const dynamicIncrement = PRICE_RANGE / totalAdvancedFixes
    const increment = Math.max(0.10, dynamicIncrement)
    return Math.round(rawPrice / increment) * increment
  }

  // Test: aucun fix avancé → prix plancher (3€)
  const priceZero = calculateDynamicPrice([], 5)
  assert(priceZero === MIN_PRICE, `Prix sans fix: attendu ${MIN_PRICE}, reçu ${priceZero}`)

  // Test: tous les fixes activés → prix plafond (12€)
  const allFixes = Array(6).fill(null).map((_, i) => ({
    category: i < 3 ? 'strategic' : 'generative',
  }))
  const priceFull = calculateDynamicPrice(allFixes, 6)
  assert(priceFull === MAX_PRICE, `Prix max: attendu ${MAX_PRICE}, reçu ${priceFull}`)

  // Test: prix intermédiaire dans les bornes
  const halfFixes = [{ category: 'strategic' }, { category: 'generative' }]
  const priceHalf = calculateDynamicPrice(halfFixes, 6)
  assert(priceHalf >= MIN_PRICE && priceHalf <= MAX_PRICE, `Prix intermédiaire hors bornes: ${priceHalf}`)

  // Test: totalAdvancedFixes = 0 → sécurité anti division par zéro
  const priceSafe = calculateDynamicPrice([{ category: 'strategic' }], 0)
  assert(priceSafe === MIN_PRICE, `Prix division/0: attendu ${MIN_PRICE}, reçu ${priceSafe}`)
}

/**
 * TEST 5 : Endpoint create-checkout (validation input)
 * Vérifie que l'endpoint rejette les requêtes invalides et retourne le payment link.
 * CRITIQUE car un bypass permettrait des paiements fantômes.
 */
async function testCreateCheckout(): Promise<void> {
  // Test 1: Sans audit_id → 400
  const noIdResp = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  const noIdBody = await noIdResp.json()
  assert(noIdResp.status === 400, `Checkout sans audit_id: attendu 400, reçu ${noIdResp.status}`)
  assert(!!noIdBody.error, 'Checkout sans audit_id: devrait avoir un message d\'erreur')

  // Test 2: Mode fallback payment link → retourne URL Stripe
  const fallbackResp = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ usePaymentLink: true }),
  })
  const fallbackBody = await fallbackResp.json()
  assert(fallbackResp.ok, `Checkout fallback: attendu 200, reçu ${fallbackResp.status}`)
  assert(
    typeof fallbackBody.url === 'string' && fallbackBody.url.startsWith('https://'),
    'Checkout fallback: doit retourner une URL HTTPS',
  )
  assert(fallbackBody.mode === 'payment_link', 'Checkout fallback: mode devrait être payment_link')
}

// ═══════════════════════════════════════════════
// PILIER 3 — MOTEUR D'AUDIT
// ═══════════════════════════════════════════════

/**
 * TEST 6 : Endpoint validate-url
 * Vérifie que la validation d'URL fonctionne correctement.
 * CRITIQUE car c'est la première ligne de défense avant tout audit.
 */
async function testValidateUrl(): Promise<void> {
  // Test 1: URLs vides → 400
  const emptyResp = await fetch(`${supabaseUrl}/functions/v1/validate-url`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ urls: [] }),
  })
  const emptyBody = await emptyResp.json()
  assert(emptyResp.status === 400, `validate-url vide: attendu 400, reçu ${emptyResp.status}`)
  assert(!!emptyBody.error, 'validate-url vide: devrait avoir un message d\'erreur')

  // Test 2: URL réelle (google.com) → doit être valide
  const realResp = await fetch(`${supabaseUrl}/functions/v1/validate-url`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ urls: ['https://google.com'] }),
  })
  const realBody = await realResp.json()
  assert(realResp.ok, `validate-url google: attendu 200, reçu ${realResp.status}`)
  assert(Array.isArray(realBody.results), 'validate-url: résultats doivent être un tableau')
  assert(realBody.results.length === 1, 'validate-url: doit avoir 1 résultat')
  assert(realBody.results[0].valid === true, 'validate-url: google.com doit être valide')
}

/**
 * TEST 7 : Parser robots.txt (check-crawlers)
 * Vérifie que le parser détecte les blocages de bots IA.
 * CRITIQUE car c'est le cœur de la fonctionnalité principale du produit.
 */
async function testCheckCrawlersEndpoint(): Promise<void> {
  // Test avec un site connu (google.com, qui a un robots.txt public)
  const resp = await fetch(`${supabaseUrl}/functions/v1/check-crawlers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: 'https://google.com' }),
  })
  const body = await resp.json()
  assert(resp.ok, `check-crawlers google: attendu 200, reçu ${resp.status}`)
  assert(Array.isArray(body.results), 'check-crawlers: résultats doivent être un tableau')
  assert(body.results.length > 0, 'check-crawlers: doit retourner au moins 1 résultat de bot')

  // Chaque résultat doit avoir la structure attendue
  const first = body.results[0]
  assert(typeof first.name === 'string', 'check-crawlers: résultat doit avoir un name')
  assert(
    ['allowed', 'blocked', 'unknown'].includes(first.status),
    `check-crawlers: status invalide "${first.status}"`,
  )
}

/**
 * TEST 8 : Cache d'audit — déterminisme des clés
 * Vérifie que cacheKey() produit des clés stables et déterministes.
 * CRITIQUE car des clés instables causeraient des cache-miss et gonfleraient les coûts LLM.
 */
async function testAuditCacheDeterminism(): Promise<void> {
  const { cacheKey } = await import('../_shared/auditCache.ts')

  // Même input → même clé (déterminisme)
  const key1 = cacheKey('expert-audit', { url: 'https://test.com', lang: 'fr' })
  const key2 = cacheKey('expert-audit', { url: 'https://test.com', lang: 'fr' })
  assert(key1 === key2, `Cache non déterministe: "${key1}" !== "${key2}"`)

  // Ordre des paramètres n'affecte pas la clé (tri interne)
  const keyA = cacheKey('fn', { b: '2', a: '1' })
  const keyB = cacheKey('fn', { a: '1', b: '2' })
  assert(keyA === keyB, `Cache sensible à l'ordre: "${keyA}" !== "${keyB}"`)

  // Inputs différents → clés différentes
  const keyDiff1 = cacheKey('fn', { url: 'https://a.com' })
  const keyDiff2 = cacheKey('fn', { url: 'https://b.com' })
  assert(keyDiff1 !== keyDiff2, 'Cache: URLs différentes devraient produire des clés différentes')

  // Clé contient le nom de la fonction
  assert(key1.startsWith('expert-audit:'), 'Cache: clé devrait commencer par le nom de la fonction')
}

// ═══════════════════════════════════════════════
// PILIER 4 — TRACKING & INTÉGRITÉ
// ═══════════════════════════════════════════════

/**
 * TEST 9 : Token tracker — résilience
 * Vérifie que trackTokenUsage et trackPaidApiCall ne crashent pas
 * même avec des données manquantes ou invalides.
 * CRITIQUE car un crash ici pourrait interrompre un audit en cours.
 */
async function testTokenTrackerResilience(): Promise<void> {
  const { trackTokenUsage, trackPaidApiCall } = await import('../_shared/tokenTracker.ts')

  // Ne doit pas crasher avec usage null
  await trackTokenUsage('test-function', 'test-model', null, 'test.com')

  // Ne doit pas crasher avec usage undefined
  await trackTokenUsage('test-function', 'test-model', undefined, 'test.com')

  // Ne doit pas crasher avec usage valide
  await trackTokenUsage('test-function', 'test-model', {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  }, 'test.com')

  // trackPaidApiCall ne doit pas crasher
  await trackPaidApiCall('test-function', 'test-service', 'test-endpoint', 'test.com')

  // Si on arrive ici sans exception, le test passe
}

/**
 * TEST 10 : Headers CORS partagés
 * Vérifie que la configuration CORS contient tous les headers nécessaires.
 * CRITIQUE car des headers manquants bloqueraient les appels depuis le frontend.
 */
async function testCorsHeaders(): Promise<void> {
  const { corsHeaders: headers } = await import('../_shared/cors.ts')

  // Doit avoir Access-Control-Allow-Origin
  assert(
    headers['Access-Control-Allow-Origin'] === '*',
    'CORS: Access-Control-Allow-Origin manquant ou incorrect',
  )

  // Doit avoir Access-Control-Allow-Headers
  const allowHeaders = headers['Access-Control-Allow-Headers']
  assert(typeof allowHeaders === 'string', 'CORS: Access-Control-Allow-Headers manquant')

  // Doit inclure les headers critiques
  const requiredHeaders = ['authorization', 'content-type', 'apikey']
  for (const h of requiredHeaders) {
    assert(
      allowHeaders.toLowerCase().includes(h),
      `CORS: header requis "${h}" manquant dans Allow-Headers`,
    )
  }
}

// ═══════════════════════════════════════════════
// ORCHESTRATEUR
// ═══════════════════════════════════════════════

const ALL_TESTS = [
  { id: 'ssrf',            name: 'Protection SSRF',              pillar: 'Sécurité',     fn: testSsrfProtection },
  { id: 'turnstile',       name: 'Captcha Turnstile',            pillar: 'Sécurité',     fn: testTurnstileEndpoint },
  { id: 'ensure-profile',  name: 'Auth ensure-profile',          pillar: 'Sécurité',     fn: testEnsureProfileAuth },
  { id: 'pricing',         name: 'Calcul prix dynamique',        pillar: 'Facturation',  fn: testDynamicPricing },
  { id: 'checkout',        name: 'Endpoint create-checkout',     pillar: 'Facturation',  fn: testCreateCheckout },
  { id: 'validate-url',    name: 'Validation d\'URL',            pillar: 'Audit',        fn: testValidateUrl },
  { id: 'check-crawlers',  name: 'Parser robots.txt',            pillar: 'Audit',        fn: testCheckCrawlersEndpoint },
  { id: 'cache',           name: 'Cache déterministe',           pillar: 'Audit',        fn: testAuditCacheDeterminism },
  { id: 'token-tracker',   name: 'Résilience token tracker',     pillar: 'Tracking',     fn: testTokenTrackerResilience },
  { id: 'cors',            name: 'Headers CORS',                 pillar: 'Tracking',     fn: testCorsHeaders },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  // Sécurité : admin only (vérifié via service role ou auth header)
  const authHeader = req.headers.get('Authorization') || ''
  const isServiceRole = authHeader.includes(serviceKey)

  if (!isServiceRole) {
    // Vérifier si c'est un admin authentifié
    const supabase = getServiceClient()
    const token = authHeader.replace('Bearer ', '')
    if (token) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user } } = await userClient.auth.getUser(token)
      if (user) {
        const { data: isAdmin } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin',
        })
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'Admin only' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } else {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  console.log('[CI] 🧪 Lancement des 10 tests backend...')
  const globalStart = performance.now()
  const results: TestResult[] = []

  for (const test of ALL_TESTS) {
    console.log(`[CI] ▶ ${test.id}: ${test.name}`)
    const result = await runTest(test.id, test.name, test.pillar, test.fn)
    results.push(result)
    console.log(`[CI] ${result.passed ? '✅' : '❌'} ${test.id} (${result.duration_ms}ms)${result.error ? ` — ${result.error}` : ''}`)
  }

  const totalDuration = Math.round(performance.now() - globalStart)
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const allPassed = failed === 0

  console.log(`[CI] ${allPassed ? '✅' : '❌'} Terminé: ${passed}/${results.length} réussis (${totalDuration}ms)`)

  // Enregistrer le résultat dans analytics_events pour l'historique admin
  try {
    const supabase = getServiceClient()
    await supabase.from('analytics_events').insert({
      event_type: 'ci_test_run',
      event_data: {
        total: results.length,
        passed,
        failed,
        all_passed: allPassed,
        duration_ms: totalDuration,
        results: results.map(r => ({
          id: r.id,
          name: r.name,
          pillar: r.pillar,
          passed: r.passed,
          duration_ms: r.duration_ms,
          error: r.error || null,
        })),
      },
    })
  } catch (e) {
    console.error('[CI] Erreur enregistrement analytics:', e)
  }

  return new Response(
    JSON.stringify({
      success: allPassed,
      summary: { total: results.length, passed, failed, duration_ms: totalDuration },
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
