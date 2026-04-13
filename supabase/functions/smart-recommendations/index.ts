import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════════════════════
// SMART RECOMMENDATIONS ENGINE — Gate Conditionnel
// Évalue la maturité d'un site et retourne les recommandations
// débloquées en fonction des critères atteints.
// ═══════════════════════════════════════════════════════════

interface MaturityCriteria {
  has_audit: boolean;
  has_strategic_audit: boolean;
  has_crawl: boolean;
  crawl_count: number;
  has_gsc: boolean;
  has_cms: boolean;
  has_ga4: boolean;
  seo_score: number;
  geo_score: number;
  pages_crawled: number;
  site_age_days: number;
  has_identity_card: boolean;
  has_cocoon: boolean;
  has_corrective_code: boolean;
  has_backlinks_data: boolean;
  audit_count: number;
}

interface RecommendationDef {
  key: string;
  title: string;
  description: string;
  category: 'seo' | 'geo' | 'performance' | 'content' | 'advanced';
  maturity_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  priority: number;
  unlock_criteria: Record<string, any>;
  action_label: string;
  action_function?: string;
  icon: string;
}

// ─── Catalogue de recommandations ───
const RECOMMENDATIONS: RecommendationDef[] = [
  // ═══ BEGINNER ═══
  {
    key: 'first_audit',
    title: 'Lancer votre premier audit SEO',
    description: 'Obtenez un diagnostic complet de votre site en quelques secondes.',
    category: 'seo',
    maturity_level: 'beginner',
    priority: 100,
    unlock_criteria: {},
    action_label: 'Lancer un audit',
    icon: 'search',
  },
  {
    key: 'connect_gsc',
    title: 'Connecter Google Search Console',
    description: 'Débloquez les données de positionnement réelles et les requêtes de recherche.',
    category: 'seo',
    maturity_level: 'beginner',
    priority: 95,
    unlock_criteria: { has_audit: true },
    action_label: 'Connecter GSC',
    icon: 'link',
  },
  {
    key: 'identity_card',
    title: 'Remplir la carte d\'identité du site',
    description: 'Améliorez la précision des recommandations IA en décrivant votre activité.',
    category: 'seo',
    maturity_level: 'beginner',
    priority: 90,
    unlock_criteria: { has_audit: true },
    action_label: 'Remplir la fiche',
    icon: 'id-card',
  },
  {
    key: 'first_crawl',
    title: 'Crawler votre site (multi-pages)',
    description: 'Découvrez les liens cassés, redirections et pages orphelines.',
    category: 'seo',
    maturity_level: 'beginner',
    priority: 85,
    unlock_criteria: { has_audit: true },
    action_label: 'Lancer un crawl',
    icon: 'radar',
  },

  // ═══ INTERMEDIATE ═══
  {
    key: 'strategic_audit',
    title: 'Audit Stratégique IA',
    description: 'Analyse de positionnement par mots-clés, gaps concurrentiels et opportunités SERP.',
    category: 'seo',
    maturity_level: 'intermediate',
    priority: 80,
    unlock_criteria: { has_audit: true, seo_score_min: 30 },
    action_label: 'Lancer l\'audit stratégique',
    action_function: 'audit-strategique-ia',
    icon: 'target',
  },
  {
    key: 'deploy_corrective',
    title: 'Déployer le code correctif',
    description: 'Appliquez automatiquement les correctifs SEO détectés (meta, schema, etc.).',
    category: 'seo',
    maturity_level: 'intermediate',
    priority: 78,
    unlock_criteria: { has_audit: true, has_cms: true },
    action_label: 'Ouvrir l\'Architecte Code',
    icon: 'wrench',
  },
  {
    key: 'cocoon_analysis',
    title: 'Analyse Cocon Sémantique',
    description: 'Structurez votre maillage interne avec l\'IA pour maximiser le PageRank interne.',
    category: 'content',
    maturity_level: 'intermediate',
    priority: 75,
    unlock_criteria: { crawl_count_min: 1, pages_crawled_min: 10 },
    action_label: 'Ouvrir le Stratège Cocoon',
    icon: 'network',
  },
  {
    key: 'connect_ga4',
    title: 'Connecter Google Analytics 4',
    description: 'Mesurez l\'impact réel de vos optimisations sur le trafic et les conversions.',
    category: 'performance',
    maturity_level: 'intermediate',
    priority: 70,
    unlock_criteria: { has_gsc: true },
    action_label: 'Connecter GA4',
    icon: 'bar-chart',
  },

  // ═══ ADVANCED ═══
  {
    key: 'featured_snippet',
    title: 'Optimisation Featured Snippet',
    description: 'Analysez le détenteur actuel du snippet et obtenez des recommandations ciblées pour le conquérir.',
    category: 'seo',
    maturity_level: 'advanced',
    priority: 65,
    unlock_criteria: { has_gsc: true, seo_score_min: 60, has_strategic_audit: true },
    action_label: 'Analyser les snippets',
    action_function: 'audit-strategique-ia',
    icon: 'star',
  },
  {
    key: 'indexation_review',
    title: 'Revue d\'indexation GSC',
    description: 'Identifiez les pages importantes non indexées et les blocages techniques.',
    category: 'seo',
    maturity_level: 'advanced',
    priority: 63,
    unlock_criteria: { has_gsc: true, site_age_days_min: 14 },
    action_label: 'Vérifier l\'indexation',
    icon: 'file-search',
  },
  {
    key: 'content_architect',
    title: 'Architecte de Contenu IA',
    description: 'Générez des briefs éditoriaux optimisés SEO basés sur vos données stratégiques.',
    category: 'content',
    maturity_level: 'advanced',
    priority: 60,
    unlock_criteria: { has_strategic_audit: true, has_identity_card: true },
    action_label: 'Ouvrir l\'Architecte Contenu',
    icon: 'pen-tool',
  },
  {
    key: 'site_architecture_review',
    title: 'Revue de l\'architecture du site',
    description: 'Évaluez la structure de navigation et identifiez les problèmes de profondeur de clic.',
    category: 'seo',
    maturity_level: 'advanced',
    priority: 58,
    unlock_criteria: { crawl_count_min: 2, pages_crawled_min: 50 },
    action_label: 'Analyser la structure',
    icon: 'git-branch',
  },
  {
    key: 'mobile_dedicated',
    title: 'Audit Mobile Dédié',
    description: 'Analyse PageSpeed approfondie mobile avec recommandations CLS, LCP et FID spécifiques.',
    category: 'performance',
    maturity_level: 'advanced',
    priority: 55,
    unlock_criteria: { has_audit: true, seo_score_min: 50, audit_count_min: 2 },
    action_label: 'Lancer l\'audit mobile',
    action_function: 'audit-expert-seo',
    icon: 'smartphone',
  },

  // ═══ EXPERT ═══
  {
    key: 'ranking_velocity',
    title: 'Vélocité de Ranking',
    description: 'Analysez à quelle vitesse vos nouvelles pages gagnent des rankings et comparez aux benchmarks.',
    category: 'seo',
    maturity_level: 'expert',
    priority: 50,
    unlock_criteria: { has_gsc: true, site_age_days_min: 30, audit_count_min: 3 },
    action_label: 'Analyser la vélocité',
    icon: 'gauge',
  },
  {
    key: 'roi_tracking',
    title: 'Tracking ROI SEO (€)',
    description: 'Estimez la valeur économique de votre trafic organique et le ROI de chaque optimisation.',
    category: 'performance',
    maturity_level: 'expert',
    priority: 48,
    unlock_criteria: { has_gsc: true, has_ga4: true, site_age_days_min: 30 },
    action_label: 'Voir le ROI',
    icon: 'euro',
  },
  {
    key: 'cannibalization_detect',
    title: 'Détection de Cannibalisation',
    description: 'Identifiez les pages qui se font concurrence sur les mêmes mots-clés.',
    category: 'content',
    maturity_level: 'expert',
    priority: 45,
    unlock_criteria: { has_gsc: true, crawl_count_min: 2, has_strategic_audit: true },
    action_label: 'Détecter',
    icon: 'copy',
  },
  {
    key: 'autopilot',
    title: 'Mode Pilote Automatique',
    description: 'Laissez l\'IA optimiser votre site en continu avec des garde-fous configurables.',
    category: 'advanced',
    maturity_level: 'expert',
    priority: 40,
    unlock_criteria: { seo_score_min: 50, has_cms: true, has_corrective_code: true, has_cocoon: true },
    action_label: 'Configurer l\'autopilote',
    icon: 'play',
  },
  {
    key: 'competitor_monitoring',
    title: 'Monitoring Concurrentiel',
    description: 'Suivez l\'évolution des positions de vos concurrents et détectez leurs mouvements.',
    category: 'seo',
    maturity_level: 'expert',
    priority: 38,
    unlock_criteria: { has_strategic_audit: true, has_gsc: true, site_age_days_min: 30 },
    action_label: 'Configurer le monitoring',
    icon: 'eye',
  },
  {
    key: 'topical_authority_map',
    title: 'Carte d\'Autorité Topicale',
    description: 'Visualisez votre couverture thématique et identifiez les clusters à renforcer.',
    category: 'content',
    maturity_level: 'expert',
    priority: 35,
    unlock_criteria: { has_cocoon: true, crawl_count_min: 3, has_strategic_audit: true },
    action_label: 'Voir la carte',
    icon: 'map',
  },
];

// ─── Évaluation de la maturité ───
function evaluateCriteria(criteria: MaturityCriteria): Record<string, boolean> {
  return {
    has_audit: criteria.has_audit,
    has_strategic_audit: criteria.has_strategic_audit,
    has_crawl: criteria.has_crawl,
    has_gsc: criteria.has_gsc,
    has_cms: criteria.has_cms,
    has_ga4: criteria.has_ga4,
    has_identity_card: criteria.has_identity_card,
    has_cocoon: criteria.has_cocoon,
    has_corrective_code: criteria.has_corrective_code,
    has_backlinks_data: criteria.has_backlinks_data,
    seo_score_min_30: criteria.seo_score >= 30,
    seo_score_min_50: criteria.seo_score >= 50,
    seo_score_min_60: criteria.seo_score >= 60,
    crawl_count_min_1: criteria.crawl_count >= 1,
    crawl_count_min_2: criteria.crawl_count >= 2,
    crawl_count_min_3: criteria.crawl_count >= 3,
    pages_crawled_min_10: criteria.pages_crawled >= 10,
    pages_crawled_min_50: criteria.pages_crawled >= 50,
    site_age_days_min_14: criteria.site_age_days >= 14,
    site_age_days_min_30: criteria.site_age_days >= 30,
    audit_count_min_2: criteria.audit_count >= 2,
    audit_count_min_3: criteria.audit_count >= 3,
  };
}

function isUnlocked(recDef: RecommendationDef, criteria: MaturityCriteria): { unlocked: boolean; met: Record<string, boolean>; required: Record<string, any> } {
  const req = recDef.unlock_criteria;
  const met: Record<string, boolean> = {};
  let allMet = true;

  for (const [key, value] of Object.entries(req)) {
    if (key === 'has_audit') { met[key] = criteria.has_audit; }
    else if (key === 'has_strategic_audit') { met[key] = criteria.has_strategic_audit; }
    else if (key === 'has_gsc') { met[key] = criteria.has_gsc; }
    else if (key === 'has_cms') { met[key] = criteria.has_cms; }
    else if (key === 'has_ga4') { met[key] = criteria.has_ga4; }
    else if (key === 'has_identity_card') { met[key] = criteria.has_identity_card; }
    else if (key === 'has_cocoon') { met[key] = criteria.has_cocoon; }
    else if (key === 'has_corrective_code') { met[key] = criteria.has_corrective_code; }
    else if (key === 'seo_score_min') { met[key] = criteria.seo_score >= (value as number); }
    else if (key === 'crawl_count_min') { met[key] = criteria.crawl_count >= (value as number); }
    else if (key === 'pages_crawled_min') { met[key] = criteria.pages_crawled >= (value as number); }
    else if (key === 'site_age_days_min') { met[key] = criteria.site_age_days >= (value as number); }
    else if (key === 'audit_count_min') { met[key] = criteria.audit_count >= (value as number); }
    else { met[key] = false; }

    if (!met[key]) allMet = false;
  }

  return { unlocked: allMet, met, required: req };
}

function computeMaturityLevel(criteria: MaturityCriteria): string {
  const score = (criteria.has_audit ? 1 : 0) +
    (criteria.has_strategic_audit ? 1 : 0) +
    (criteria.has_crawl ? 1 : 0) +
    (criteria.has_gsc ? 2 : 0) +
    (criteria.has_cms ? 1 : 0) +
    (criteria.has_ga4 ? 1 : 0) +
    (criteria.has_identity_card ? 1 : 0) +
    (criteria.has_cocoon ? 1 : 0) +
    (criteria.has_corrective_code ? 1 : 0) +
    (criteria.seo_score >= 60 ? 2 : criteria.seo_score >= 30 ? 1 : 0) +
    (criteria.crawl_count >= 3 ? 2 : criteria.crawl_count >= 1 ? 1 : 0) +
    (criteria.site_age_days >= 30 ? 1 : 0);

  if (score >= 12) return 'expert';
  if (score >= 8) return 'advanced';
  if (score >= 4) return 'intermediate';
  return 'beginner';
}

Deno.serve(handleRequest(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { tracked_site_id } = await req.json();
    if (!tracked_site_id) {
      return new Response(JSON.stringify({ error: 'tracked_site_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── 1. Gather maturity criteria from DB ───
    const [
      siteRes,
      crawlsRes,
      gscRes,
      cmsRes,
      ga4Res,
      cocoonRes,
      codeRes,
      backlinksRes,
    ] = await Promise.all([
      supabase.from('tracked_sites').select('id, domain, created_at, identity_card, last_audit_at').eq('id', tracked_site_id).eq('user_id', user.id).maybeSingle(),
      // site_crawls has no tracked_site_id column – will re-query by domain below
      Promise.resolve({ data: null }),
      supabase.from('gsc_connections').select('id').eq('tracked_site_id', tracked_site_id).eq('is_active', true).limit(1),
      supabase.from('cms_connections').select('id').eq('tracked_site_id', tracked_site_id).limit(1),
      supabase.from('ga4_connections').select('id').eq('tracked_site_id', tracked_site_id).eq('is_active', true).limit(1),
      supabase.from('cocoon_diagnostic_results').select('id').eq('tracked_site_id', tracked_site_id).limit(1),
      supabase.from('site_script_rules').select('id').eq('domain_id', tracked_site_id).limit(1),
      supabase.from('backlink_snapshots').select('id').eq('tracked_site_id', tracked_site_id).limit(1),
    ]);

    if (!siteRes.data) {
      return new Response(JSON.stringify({ error: 'Site not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const site = siteRes.data as any;
    const domain = site.domain;
    const domainNorm = domain.replace(/^www\./, '');

    // Re-query site_crawls by domain (no tracked_site_id column)
    const { data: crawlData } = await supabase.from('site_crawls')
      .select('id, total_pages')
      .or(`domain.eq.${domainNorm},domain.eq.www.${domainNorm}`)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10);
    crawlRes = { data: crawlData };

    // Get audit data with actual domain
    const { data: auditData } = await supabase.from('audit_raw_data')
      .select('id, raw_payload, audit_type')
      .eq('domain', domain)
      .order('created_at', { ascending: false })
      .limit(20);

    const audits = auditData || [];
    const techAudits = audits.filter((a: any) => ['technical', 'seo'].includes(a.audit_type));
    const strategicAudits = audits.filter((a: any) => ['strategic', 'strategic_parallel'].includes(a.audit_type));

    // Extract SEO score from latest tech audit
    let seoScore = 0;
    if (techAudits.length > 0) {
      const payload = techAudits[0].raw_payload as any;
      seoScore = payload?.overallScore || payload?.scores?.technical || payload?.scores?.seo || 0;
    }

    const crawls = crawlsRes.data || [];
    const totalPagesCrawled = crawls.reduce((sum: number, c: any) => sum + (c.total_pages || 0), 0);

    const siteCreatedAt = new Date(site.created_at);
    const siteAgeDays = Math.floor((Date.now() - siteCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

    const criteria: MaturityCriteria = {
      has_audit: techAudits.length > 0,
      has_strategic_audit: strategicAudits.length > 0,
      has_crawl: crawls.length > 0,
      crawl_count: crawls.length,
      has_gsc: (gscRes.data?.length || 0) > 0,
      has_cms: (cmsRes.data?.length || 0) > 0,
      has_ga4: (ga4Res.data?.length || 0) > 0,
      seo_score: seoScore,
      geo_score: 0,
      pages_crawled: totalPagesCrawled,
      site_age_days: siteAgeDays,
      has_identity_card: !!(site.identity_card),
      has_cocoon: (cocoonRes.data?.length || 0) > 0,
      has_corrective_code: (codeRes.data?.length || 0) > 0,
      has_backlinks_data: (backlinksRes.data?.length || 0) > 0,
      audit_count: techAudits.length,
    };

    const maturityLevel = computeMaturityLevel(criteria);

    // ─── 2. Evaluate each recommendation ───
    const evaluatedRecs = RECOMMENDATIONS.map(rec => {
      const result = isUnlocked(rec, criteria);
      return {
        recommendation_key: rec.key,
        title: rec.title,
        description: rec.description,
        category: rec.category,
        maturity_level: rec.maturity_level,
        priority: rec.priority,
        is_unlocked: result.unlocked,
        unlock_criteria_met: result.met,
        unlock_criteria_required: result.required,
        action_label: rec.action_label,
        action_function: rec.action_function || null,
        icon: rec.icon,
      };
    });

    // ─── 3. Upsert into smart_recommendations ───
    const upsertData = evaluatedRecs.map(rec => ({
      tracked_site_id,
      user_id: user.id,
      recommendation_key: rec.recommendation_key,
      is_unlocked: rec.is_unlocked,
      unlock_criteria_met: rec.unlock_criteria_met,
      unlock_criteria_required: rec.unlock_criteria_required,
      maturity_level: rec.maturity_level,
      last_evaluated_at: new Date().toISOString(),
      status: rec.is_unlocked ? 'unlocked' : 'locked',
      category: rec.category,
      title: rec.title,
      description: rec.description,
      priority: rec.priority,
      recommendation_data: {
        action_label: rec.action_label,
        action_function: rec.action_function,
        icon: rec.icon,
      },
    }));

    // Don't overwrite status if user already actioned/dismissed
    for (const item of upsertData) {
      const { data: existing } = await supabase
        .from('smart_recommendations')
        .select('status')
        .eq('tracked_site_id', tracked_site_id)
        .eq('recommendation_key', item.recommendation_key)
        .maybeSingle();

      if (existing && ['actioned', 'dismissed'].includes(existing.status)) {
        // Keep user's status but update unlock state
        await supabase.from('smart_recommendations')
          .update({
            is_unlocked: item.is_unlocked,
            unlock_criteria_met: item.unlock_criteria_met,
            last_evaluated_at: item.last_evaluated_at,
          })
          .eq('tracked_site_id', tracked_site_id)
          .eq('recommendation_key', item.recommendation_key);
      } else {
        await supabase.from('smart_recommendations')
          .upsert(item, { onConflict: 'tracked_site_id,recommendation_key' });
      }
    }

    // ─── 4. Compute summary stats ───
    const unlockedCount = evaluatedRecs.filter(r => r.is_unlocked).length;
    const totalCount = evaluatedRecs.length;
    const nextUnlock = evaluatedRecs
      .filter(r => !r.is_unlocked)
      .sort((a, b) => b.priority - a.priority)[0] || null;

    const nextUnlockHint = nextUnlock ? {
      key: nextUnlock.recommendation_key,
      title: nextUnlock.title,
      missing: Object.entries(nextUnlock.unlock_criteria_met)
        .filter(([_, v]) => !v)
        .map(([k]) => k),
    } : null;

    return new Response(JSON.stringify({
      success: true,
      site_maturity: {
        level: maturityLevel,
        criteria,
        seo_score: seoScore,
      },
      recommendations: evaluatedRecs.sort((a, b) => {
        // Unlocked first, then by priority
        if (a.is_unlocked !== b.is_unlocked) return a.is_unlocked ? -1 : 1;
        return b.priority - a.priority;
      }),
      summary: {
        unlocked: unlockedCount,
        total: totalCount,
        progress_pct: Math.round((unlockedCount / totalCount) * 100),
        next_unlock_hint: nextUnlockHint,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SMART-RECO] Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}, 'smart-recommendations'))
