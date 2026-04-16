/**
 * editorial-pipeline-run — HTTP wrapper for the shared 4-stage editorial pipeline.
 * Used by Parménion, Content Architect, Social Hub and any UI that wants the full
 * briefing → strategist → writer → tonalizer chain.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { handleRequest } from '../_shared/serveHandler.ts';
import { runEditorialPipeline, type ContentType, type PipelineInput } from '../_shared/editorialPipeline.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_CONTENT_TYPES: ContentType[] = [
  'blog_article',
  'seo_page',
  'social_post',
  'email',
  'landing_page',
  'guide',
  'faq',
];

Deno.serve(handleRequest(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      domain,
      tracked_site_id,
      content_type,
      target_url,
      user_brief,
      override_models,
    } = body;

    if (!domain || !content_type) {
      return new Response(
        JSON.stringify({ error: 'domain and content_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!VALID_CONTENT_TYPES.includes(content_type)) {
      return new Response(
        JSON.stringify({
          error: `Invalid content_type. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = getServiceClient();

    const input: PipelineInput = {
      user_id: auth.userId, // CRITICAL: use JWT identity, never client-supplied
      domain,
      tracked_site_id,
      content_type,
      target_url,
      user_brief,
      override_models,
    };

    const result = await runEditorialPipeline(supabase, input);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[editorial-pipeline-run] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}, 'editorial-pipeline-run'));
