import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * gtm-actions — Google Tag Manager API integration
 * 
 * Actions:
 *   list-containers → Lists GTM accounts & containers for the user
 *   deploy-tag      → Creates Crawlers tag + publishes a new version
 *   check-tag       → Checks if Crawlers tag exists in a container
 *   remove-tag      → Removes Crawlers tag from a container
 */

const TAG_NAME = 'Crawlers.AI SEO/GEO Optimizer';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { action, user_id, site_id, container_path, account_path } = await req.json();

    if (!action || !user_id) {
      return new Response(JSON.stringify({ error: 'action and user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve Google token for user
    const accessToken = await resolveGoogleToken(supabase, user_id);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Google not connected or token expired', code: 'NO_GOOGLE_TOKEN' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (action) {
      case 'list-containers':
        return await handleListContainers(accessToken);
      case 'deploy-tag':
        return await handleDeployTag(accessToken, supabase, user_id, site_id, container_path, account_path);
      case 'check-tag':
        return await handleCheckTag(accessToken, container_path);
      case 'remove-tag':
        return await handleRemoveTag(accessToken, container_path);
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('[gtm-actions] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ═══════════════════════════════════════════════
// Token resolution
// ═══════════════════════════════════════════════

async function resolveGoogleToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: connections } = await supabase
    .from('google_connections')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!connections || connections.length === 0) return null;

  const conn = connections[0];
  
  // Check if token is expired
  if (conn.token_expiry && new Date(conn.token_expiry) < new Date()) {
    if (!conn.refresh_token) return null;
    
    // Refresh the token
    const clientId = Deno.env.get('GOOGLE_GSC_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_GSC_CLIENT_SECRET');
    if (!clientId || !clientSecret) return null;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!resp.ok) return null;
    const tokens = await resp.json();

    await supabase
      .from('google_connections')
      .update({
        access_token: tokens.access_token,
        token_expiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      } as any)
      .eq('user_id', userId);

    return tokens.access_token;
  }

  return conn.access_token;
}

// ═══════════════════════════════════════════════
// List accounts & containers
// ═══════════════════════════════════════════════

async function handleListContainers(accessToken: string) {
  // 1. List accounts
  const accountsResp = await fetch('https://tagmanager.googleapis.com/tagmanager/v2/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!accountsResp.ok) {
    const errBody = await accountsResp.text();
    if (accountsResp.status === 403) {
      return new Response(JSON.stringify({ 
        error: 'GTM access denied. Please reconnect Google with GTM permissions.',
        code: 'GTM_SCOPE_MISSING',
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`GTM API accounts error ${accountsResp.status}: ${errBody}`);
  }

  const accountsData = await accountsResp.json();
  const accounts = accountsData.account || [];

  // 2. List containers for each account
  const results: Array<{ account_id: string; account_name: string; containers: Array<{ container_id: string; name: string; path: string; public_id: string }> }> = [];

  for (const account of accounts) {
    const containersResp = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/${account.path}/containers`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!containersResp.ok) {
      await containersResp.text();
      continue;
    }

    const containersData = await containersResp.json();
    const containers = (containersData.container || []).map((c: any) => ({
      container_id: c.containerId,
      name: c.name,
      path: c.path,
      public_id: c.publicId,
    }));

    results.push({
      account_id: account.accountId,
      account_name: account.name,
      containers,
    });
  }

  return new Response(JSON.stringify({ success: true, accounts: results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ═══════════════════════════════════════════════
// Deploy Crawlers tag
// ═══════════════════════════════════════════════

async function handleDeployTag(
  accessToken: string,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  siteId: string,
  containerPath: string,
  accountPath: string,
) {
  if (!containerPath || !siteId) {
    throw new Error('container_path and site_id required');
  }

  // Get site API key
  const { data: profile } = await supabase
    .from('profiles')
    .select('api_key')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile?.api_key) throw new Error('No API key found for user');

  // Check if tag already exists
  const existing = await findCrawlersTag(accessToken, containerPath);
  if (existing) {
    return new Response(JSON.stringify({ 
      success: true, 
      already_exists: true, 
      tag_id: existing.tagId,
      message: 'Crawlers tag already deployed in this container',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create workspace
  const wsResp = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/${containerPath}/workspaces`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Crawlers Deploy ${new Date().toISOString().split('T')[0]}`,
      description: 'Auto-generated by Crawlers.AI for SEO/GEO optimization script deployment',
    }),
  });

  if (!wsResp.ok) {
    const err = await wsResp.text();
    throw new Error(`Failed to create workspace: ${wsResp.status} ${err}`);
  }

  const workspace = await wsResp.json();

  // Create the tag
  const tagBody = {
    name: TAG_NAME,
    type: 'html',
    parameter: [
      {
        type: 'TEMPLATE',
        key: 'html',
        value: `<script>\n  window.CRAWLERS_API_KEY = "${profile.api_key}";\n</script>\n<script src="https://crawlers.fr/widget.js" defer></script>`,
      },
      {
        type: 'BOOLEAN',
        key: 'supportDocumentWrite',
        value: 'false',
      },
    ],
    firingTriggerId: ['2147479553'], // All Pages built-in trigger
    tagFiringOption: 'ONCE_PER_EVENT',
  };

  const tagResp = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/${workspace.path}/tags`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(tagBody),
  });

  if (!tagResp.ok) {
    const err = await tagResp.text();
    throw new Error(`Failed to create tag: ${tagResp.status} ${err}`);
  }

  const tag = await tagResp.json();

  // Publish the workspace as a new version
  const versionResp = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/${workspace.path}:create_version`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Crawlers.AI v${new Date().toISOString().split('T')[0]}`,
      notes: 'Deployed Crawlers.AI SEO/GEO optimization script',
    }),
  });

  if (!versionResp.ok) {
    const err = await versionResp.text();
    throw new Error(`Failed to create version: ${versionResp.status} ${err}`);
  }

  const versionData = await versionResp.json();
  const containerVersion = versionData.containerVersion;

  // Publish the version
  if (containerVersion?.path) {
    const publishResp = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/${containerVersion.path}:publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!publishResp.ok) {
      console.warn('[gtm-actions] Publish warning:', await publishResp.text());
    }
  }

  // Update tracked_site with GTM info
  await supabase
    .from('tracked_sites')
    .update({
      current_config: {
        gtm_deployed: true,
        gtm_container_path: containerPath,
        gtm_tag_id: tag.tagId,
        gtm_deployed_at: new Date().toISOString(),
      },
    } as any)
    .eq('id', siteId);

  return new Response(JSON.stringify({
    success: true,
    tag_id: tag.tagId,
    tag_name: tag.name,
    version: containerVersion?.containerVersionId,
    message: 'Crawlers tag deployed and published successfully',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ═══════════════════════════════════════════════
// Check if Crawlers tag exists
// ═══════════════════════════════════════════════

async function findCrawlersTag(accessToken: string, containerPath: string) {
  // List tags in default workspace
  const wsResp = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/${containerPath}/workspaces`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!wsResp.ok) return null;

  const wsData = await wsResp.json();
  const defaultWs = (wsData.workspace || []).find((w: any) => w.name === 'Default Workspace') || (wsData.workspace || [])[0];

  if (!defaultWs) return null;

  const tagsResp = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/${defaultWs.path}/tags`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!tagsResp.ok) return null;

  const tagsData = await tagsResp.json();
  return (tagsData.tag || []).find((t: any) => 
    t.name === TAG_NAME || 
    t.parameter?.some((p: any) => p.value?.includes('CRAWLERS_API_KEY'))
  );
}

async function handleCheckTag(accessToken: string, containerPath: string) {
  if (!containerPath) throw new Error('container_path required');

  const tag = await findCrawlersTag(accessToken, containerPath);
  
  return new Response(JSON.stringify({
    success: true,
    exists: !!tag,
    tag_id: tag?.tagId || null,
    tag_name: tag?.name || null,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ═══════════════════════════════════════════════
// Remove Crawlers tag
// ═══════════════════════════════════════════════

async function handleRemoveTag(accessToken: string, containerPath: string) {
  if (!containerPath) throw new Error('container_path required');

  const tag = await findCrawlersTag(accessToken, containerPath);
  if (!tag) {
    return new Response(JSON.stringify({ success: true, message: 'No Crawlers tag found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Delete the tag
  const deleteResp = await fetch(`https://tagmanager.googleapis.com/tagmanager/v2/${tag.path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!deleteResp.ok) {
    const err = await deleteResp.text();
    throw new Error(`Failed to delete tag: ${deleteResp.status} ${err}`);
  }

  return new Response(JSON.stringify({ success: true, message: 'Crawlers tag removed' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
