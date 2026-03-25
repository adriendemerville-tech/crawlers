/**
 * url-structure-analyzer — Analyze and recommend URL structure improvements
 * 
 * Actions:
 *   - analyze: Audit URL structure and provide recommendations
 */
import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface UrlIssue {
  url: string
  issue_type: string
  severity: 'critical' | 'warning' | 'info'
  description: string
  recommendation: string
}

function analyzeUrl(url: string): UrlIssue[] {
  const issues: UrlIssue[] = []

  try {
    const parsed = new URL(url)
    const path = parsed.pathname
    const segments = path.split('/').filter(Boolean)

    // 1. Depth check
    if (segments.length > 4) {
      issues.push({
        url, issue_type: 'too_deep',
        severity: 'warning',
        description: `URL trop profonde (${segments.length} niveaux)`,
        recommendation: `Réduisez à max 3-4 niveaux : /${segments.slice(0, 3).join('/')}/`,
      })
    }

    // 2. Length check
    if (path.length > 115) {
      issues.push({
        url, issue_type: 'too_long',
        severity: 'warning',
        description: `URL trop longue (${path.length} caractères)`,
        recommendation: 'Raccourcissez les slugs à 3-5 mots clés maximum.',
      })
    }

    // 3. Uppercase
    if (path !== path.toLowerCase()) {
      issues.push({
        url, issue_type: 'uppercase',
        severity: 'critical',
        description: 'L\'URL contient des majuscules',
        recommendation: 'Utilisez uniquement des minuscules. Redirigez 301 vers la version en minuscules.',
      })
    }

    // 4. Underscores
    if (path.includes('_')) {
      issues.push({
        url, issue_type: 'underscores',
        severity: 'warning',
        description: 'L\'URL utilise des underscores au lieu de tirets',
        recommendation: 'Remplacez les underscores par des tirets (-). Google traite les tirets comme séparateurs de mots.',
      })
    }

    // 5. Query parameters
    if (parsed.search && parsed.search.length > 1) {
      const params = parsed.searchParams
      const paramCount = Array.from(params.keys()).length
      if (paramCount > 2) {
        issues.push({
          url, issue_type: 'too_many_params',
          severity: 'warning',
          description: `${paramCount} paramètres d'URL détectés`,
          recommendation: 'Limitez les paramètres d\'URL. Utilisez des URL propres avec des slugs pour le contenu indexable.',
        })
      }
    }

    // 6. File extensions
    if (/\.(html|htm|php|asp|aspx|jsp)$/i.test(path)) {
      issues.push({
        url, issue_type: 'file_extension',
        severity: 'info',
        description: 'Extension de fichier dans l\'URL',
        recommendation: 'Les URLs modernes n\'utilisent pas d\'extensions. Configurez la réécriture d\'URL.',
      })
    }

    // 7. Double slashes
    if (path.includes('//')) {
      issues.push({
        url, issue_type: 'double_slash',
        severity: 'critical',
        description: 'Double slash dans l\'URL',
        recommendation: 'Corrigez le double slash et redirigez 301 vers la version correcte.',
      })
    }

    // 8. Trailing slash consistency
    // (just flag for awareness — not an issue per se)

    // 9. Stop words
    const stopWords = ['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with']
    const slugWords = segments.flatMap(s => s.split('-'))
    const foundStops = slugWords.filter(w => stopWords.includes(w.toLowerCase()))
    if (foundStops.length >= 3) {
      issues.push({
        url, issue_type: 'stop_words',
        severity: 'info',
        description: `Mots vides dans l'URL : ${foundStops.join(', ')}`,
        recommendation: 'Supprimez les mots vides inutiles pour raccourcir l\'URL.',
      })
    }

    // 10. Dates in URL
    if (/\/\d{4}\/\d{2}\//.test(path)) {
      issues.push({
        url, issue_type: 'date_in_url',
        severity: 'info',
        description: 'Date dans l\'URL',
        recommendation: 'Les dates dans les URLs limitent la perception d\'actualité. Préférez une structure thématique.',
      })
    }

    // 11. IDs / numbers
    if (/\/\d{3,}(\/|$)/.test(path) || /[?&]id=\d+/.test(url)) {
      issues.push({
        url, issue_type: 'numeric_id',
        severity: 'warning',
        description: 'ID numérique dans l\'URL',
        recommendation: 'Remplacez les IDs par des slugs descriptifs pour un meilleur SEO.',
      })
    }

    // 12. Non-ASCII characters
    if (/[^\x20-\x7E]/.test(decodeURIComponent(path))) {
      issues.push({
        url, issue_type: 'non_ascii',
        severity: 'info',
        description: 'Caractères spéciaux/accentués dans l\'URL',
        recommendation: 'Utilisez des équivalents ASCII (é→e, à→a) pour une meilleure compatibilité.',
      })
    }
  } catch { /* invalid URL, skip */ }

  return issues
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { action, tracked_site_id } = await req.json()

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = getUserClient(authHeader)
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)
    if (!tracked_site_id) return json({ error: 'tracked_site_id required' }, 400)
    if (action !== 'analyze') return json({ error: `Unknown action: ${action}` }, 400)

    const sb = getServiceClient()

    const { data: site } = await sb.from('tracked_sites').select('domain').eq('id', tracked_site_id).single()
    if (!site) return json({ error: 'Site not found' }, 404)

    // Get crawled URLs
    const { data: crawlPages } = await sb
      .from('crawl_pages')
      .select('url, depth, http_status')
      .eq('tracked_site_id', tracked_site_id)
      .limit(1000)

    const urls = (crawlPages || []).map((p: any) => p.url).filter(Boolean)

    if (urls.length === 0) {
      return json({ error: 'No crawled pages found. Run a crawl first.' }, 400)
    }

    // Analyze all URLs
    const allIssues: UrlIssue[] = urls.flatMap((url: string) => analyzeUrl(url))

    // Aggregate by issue type
    const issuesByType = new Map<string, { count: number; severity: string; examples: string[] }>()
    for (const issue of allIssues) {
      const existing = issuesByType.get(issue.issue_type) || { count: 0, severity: issue.severity, examples: [] }
      existing.count++
      if (existing.examples.length < 3) existing.examples.push(issue.url)
      issuesByType.set(issue.issue_type, existing)
    }

    // Depth distribution
    const depthDist = new Map<number, number>()
    for (const page of (crawlPages || [])) {
      const d = page.depth || 0
      depthDist.set(d, (depthDist.get(d) || 0) + 1)
    }

    // Score
    const criticalCount = allIssues.filter(i => i.severity === 'critical').length
    const warningCount = allIssues.filter(i => i.severity === 'warning').length
    const urlScore = Math.max(0, 100 - criticalCount * 10 - warningCount * 3 - allIssues.filter(i => i.severity === 'info').length)

    const summary = {
      total_urls_analyzed: urls.length,
      total_issues: allIssues.length,
      critical: criticalCount,
      warnings: warningCount,
      info: allIssues.filter(i => i.severity === 'info').length,
      url_health_score: Math.min(100, urlScore),
      avg_depth: urls.length > 0 ? Math.round((crawlPages || []).reduce((s: number, p: any) => s + (p.depth || 0), 0) / urls.length * 10) / 10 : 0,
      depth_distribution: Object.fromEntries(depthDist),
      issues_by_type: Object.fromEntries(issuesByType),
    }

    // Top recommendations
    const recommendations = Array.from(issuesByType.entries())
      .sort((a, b) => {
        const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
        return (sevOrder[a[1].severity] || 2) - (sevOrder[b[1].severity] || 2) || b[1].count - a[1].count
      })
      .slice(0, 10)
      .map(([type, data]) => ({
        issue_type: type,
        count: data.count,
        severity: data.severity,
        examples: data.examples,
        recommendation: allIssues.find(i => i.issue_type === type)?.recommendation || '',
      }))

    await sb.from('analytics_events').insert({
      user_id: user.id,
      event_type: 'url-structure:analyze',
      event_data: { tracked_site_id, total_issues: allIssues.length, score: summary.url_health_score },
    }).catch(() => {})

    return json({ issues: allIssues, summary, recommendations, domain: site.domain })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[url-structure-analyzer] error:', msg)
    return json({ error: msg }, 500)
  }
})
