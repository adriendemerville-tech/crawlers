import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { trackPaidApiCall } from '../_shared/tokenTracker.ts';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';

/**
 * crawl-site v2 — Lightweight launcher
 * 1. Normalizes URL
 * 2. Deducts credits
 * 3. Creates site_crawls row
 * 4. Maps URLs via Firecrawl
 * 5. Creates crawl_jobs row with urls_to_process
 * 6. Returns immediately (worker picks it up)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');

  if (!firecrawlKey) {
    return new Response(JSON.stringify({ success: false, error: 'Firecrawl non configuré' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { url, maxPages = 50, userId } = await req.json();
    if (!url || !userId) {
      return new Response(JSON.stringify({ success: false, error: 'URL et userId requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) normalizedUrl = `https://${normalizedUrl}`;
    const domain = new URL(normalizedUrl).hostname;
    const pageLimit = Math.min(maxPages, 500);

    // Check if user is Pro Agency or Admin (unlimited crawl)
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_type, subscription_status')
      .eq('user_id', userId)
      .single();

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });

    const isProAgency = profile?.plan_type === 'agency_pro' && profile?.subscription_status === 'active';
    const isUnlimited = isProAgency || isAdmin === true;

    // Credit cost
    const creditCost = isUnlimited ? 0 : (pageLimit <= 50 ? 5 : pageLimit <= 100 ? 10 : pageLimit <= 200 ? 15 : 30);

    if (!isUnlimited) {
      // Deduct credits
      const { data: creditResult } = await supabase.rpc('use_credit', {
        p_user_id: userId,
        p_amount: creditCost,
        p_description: `Crawl multi-pages: ${domain} (${pageLimit} pages max)`,
      });

      if (!creditResult?.success) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Crédits insuffisants',
          required: creditCost,
          balance: creditResult?.balance || 0,
        }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      console.log(`[${domain}] Crawl illimité (${isProAgency ? 'Pro Agency' : 'Admin'})`);
    }

    // Create site_crawls row
    const { data: crawl, error: crawlError } = await supabase
      .from('site_crawls')
      .insert({
        user_id: userId,
        domain,
        url: normalizedUrl,
        status: 'mapping',
        total_pages: pageLimit,
        credits_used: creditCost,
      })
      .select('id')
      .single();

    if (crawlError || !crawl) {
      console.error('Erreur création crawl:', crawlError);
      return new Response(JSON.stringify({ success: false, error: 'Erreur création crawl' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const crawlId = crawl.id;
    console.log(`[${crawlId}] Mapping démarré: ${domain} (max ${pageLimit} pages)`);

    // Map URLs via Firecrawl
    const mapResponse = await fetch(`${FIRECRAWL_API}/map`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl, limit: pageLimit, includeSubdomains: false }),
    });

    const mapData = await mapResponse.json();
    if (!mapResponse.ok || !mapData.links?.length) {
      await supabase.from('site_crawls').update({ status: 'error', error_message: 'Impossible de mapper le site' }).eq('id', crawlId);
      return new Response(JSON.stringify({ success: false, error: 'Map échoué', crawlId }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const urls: string[] = mapData.links.slice(0, pageLimit);
    
    // Update site_crawls with actual URL count and set status to queued
    await supabase.from('site_crawls').update({
      total_pages: urls.length,
      status: 'queued',
    }).eq('id', crawlId);

    // Create the crawl job in the queue
    const { data: job, error: jobError } = await supabase
      .from('crawl_jobs')
      .insert({
        crawl_id: crawlId,
        user_id: userId,
        domain,
        url: normalizedUrl,
        urls_to_process: urls,
        total_count: urls.length,
        status: 'pending',
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Erreur création job:', jobError);
      await supabase.from('site_crawls').update({ status: 'error', error_message: 'Erreur file d\'attente' }).eq('id', crawlId);
      return new Response(JSON.stringify({ success: false, error: 'Erreur file d\'attente' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${crawlId}] ✅ Job ${job.id} créé avec ${urls.length} URLs — en attente du worker`);

    // Trigger the worker immediately (fire-and-forget)
    try {
      fetch(`${supabaseUrl}/functions/v1/process-crawl-queue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trigger: 'immediate' }),
      }).catch(() => {}); // fire-and-forget
    } catch {}

    return new Response(JSON.stringify({
      success: true,
      crawlId,
      jobId: job.id,
      totalPages: urls.length,
      status: 'queued',
      message: `${urls.length} pages découvertes — audit en file d'attente`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Erreur crawl-site:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
