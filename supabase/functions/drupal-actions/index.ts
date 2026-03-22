import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** ─── Helpers ────────────────────────────────────────────── */

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Missing authorization header");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { authorization: authHeader } } },
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

interface DrupalConnection {
  auth_method: string;
  site_url: string;
  oauth_access_token?: string;
  basic_auth_user?: string;
  basic_auth_pass?: string;
  api_key?: string;
}

function buildHeaders(conn: DrupalConnection): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/vnd.api+json",
    Accept: "application/vnd.api+json",
  };

  if (conn.auth_method === "oauth2" && conn.oauth_access_token) {
    headers["Authorization"] = `Bearer ${conn.oauth_access_token}`;
  } else if (conn.auth_method === "basic" && conn.basic_auth_user && conn.basic_auth_pass) {
    const encoded = btoa(`${conn.basic_auth_user}:${conn.basic_auth_pass}`);
    headers["Authorization"] = `Basic ${encoded}`;
  } else if (conn.auth_method === "api_key" && conn.api_key) {
    headers["Authorization"] = `Bearer ${conn.api_key}`;
  }

  return headers;
}

function baseUrl(conn: DrupalConnection): string {
  return conn.site_url.replace(/\/+$/, "");
}

/** ─── Drupal JSON:API Wrappers ──────────────────────────── */

async function drupalFetch(conn: DrupalConnection, path: string, options: RequestInit = {}) {
  const url = `${baseUrl(conn)}${path}`;
  const headers = { ...buildHeaders(conn), ...(options.headers as Record<string, string> || {}) };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drupal API error ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

// ─── Action: test-connection ────────────────────────────────
async function testConnection(conn: DrupalConnection) {
  const data = await drupalFetch(conn, "/jsonapi");
  return { success: true, links: Object.keys(data?.links || {}).length, meta: data?.meta };
}

// ─── Action: list-pages ─────────────────────────────────────
async function listPages(conn: DrupalConnection, params: { nodeType?: string; limit?: number; cursor?: string }) {
  const nodeType = params.nodeType || "page";
  const limit = Math.min(params.limit || 50, 50);
  let path = `/jsonapi/node/${nodeType}?page[limit]=${limit}&sort=-changed`;
  if (params.cursor) path += `&page[offset]=${params.cursor}`;

  const data = await drupalFetch(conn, path);
  const pages = (data?.data || []).map((node: any) => ({
    id: node.id,
    type: node.type,
    title: node.attributes?.title,
    path: node.attributes?.path?.alias || `/node/${node.attributes?.drupal_internal__nid}`,
    status: node.attributes?.status,
    changed: node.attributes?.changed,
    created: node.attributes?.created,
    metatag: node.attributes?.metatag || null,
  }));

  const nextLink = data?.links?.next?.href;
  const nextCursor = nextLink ? new URL(nextLink).searchParams.get("page[offset]") : null;

  return { pages, nextCursor, total: data?.meta?.count || pages.length };
}

// ─── Action: get-page ───────────────────────────────────────
async function getPage(conn: DrupalConnection, params: { nodeType: string; nodeId: string }) {
  const data = await drupalFetch(conn, `/jsonapi/node/${params.nodeType}/${params.nodeId}`);
  const node = data?.data;
  return {
    id: node.id,
    type: node.type,
    title: node.attributes?.title,
    body: node.attributes?.body?.value,
    body_format: node.attributes?.body?.format,
    path: node.attributes?.path?.alias,
    status: node.attributes?.status,
    metatag: node.attributes?.metatag || null,
    changed: node.attributes?.changed,
  };
}

// ─── Action: update-meta ────────────────────────────────────
async function updateMeta(conn: DrupalConnection, params: {
  nodeType: string;
  nodeId: string;
  title?: string;
  metatag?: Array<{ tag: string; attributes: Record<string, string> }>;
}) {
  const attributes: Record<string, any> = {};
  if (params.title) attributes.title = params.title;
  if (params.metatag) attributes.metatag = params.metatag;

  const payload = {
    data: {
      type: `node--${params.nodeType}`,
      id: params.nodeId,
      attributes,
    },
  };

  const data = await drupalFetch(conn, `/jsonapi/node/${params.nodeType}/${params.nodeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return { success: true, updated: Object.keys(attributes), id: params.nodeId };
}

// ─── Action: update-body (maillage interne) ─────────────────
async function updateBody(conn: DrupalConnection, params: {
  nodeType: string;
  nodeId: string;
  body: string;
  format?: string;
}) {
  const payload = {
    data: {
      type: `node--${params.nodeType}`,
      id: params.nodeId,
      attributes: {
        body: {
          value: params.body,
          format: params.format || "full_html",
        },
      },
    },
  };

  await drupalFetch(conn, `/jsonapi/node/${params.nodeType}/${params.nodeId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return { success: true, id: params.nodeId };
}

// ─── Action: add-internal-links ─────────────────────────────
async function addInternalLinks(conn: DrupalConnection, params: {
  nodeType: string;
  nodeId: string;
  links: Array<{ anchor: string; targetUrl: string }>;
}) {
  // Fetch current body
  const page = await getPage(conn, { nodeType: params.nodeType, nodeId: params.nodeId });
  let body = page.body || "";

  // Append links before closing </body> or at end
  const linksHtml = params.links
    .map((l) => `<a href="${l.targetUrl}">${l.anchor}</a>`)
    .join(" ");

  // Insert before last </p> or append
  const lastPIdx = body.lastIndexOf("</p>");
  if (lastPIdx !== -1) {
    body = body.slice(0, lastPIdx) + " " + linksHtml + body.slice(lastPIdx);
  } else {
    body += `<p>${linksHtml}</p>`;
  }

  return updateBody(conn, {
    nodeType: params.nodeType,
    nodeId: params.nodeId,
    body,
    format: page.body_format || "full_html",
  });
}

// ─── Action: list-redirects ─────────────────────────────────
async function listRedirects(conn: DrupalConnection) {
  try {
    const data = await drupalFetch(conn, "/jsonapi/redirect/redirect?sort=-created&page[limit]=100");
    const redirects = (data?.data || []).map((r: any) => ({
      id: r.id,
      source: r.attributes?.redirect_source?.path,
      target: r.attributes?.redirect_redirect?.uri,
      statusCode: r.attributes?.status_code,
      created: r.attributes?.created,
    }));
    return { redirects, supported: true };
  } catch {
    return { redirects: [], supported: false, message: "Module 'redirect' may not be installed or JSON:API access not enabled for redirects." };
  }
}

// ─── Action: create-redirect ────────────────────────────────
async function createRedirect(conn: DrupalConnection, params: {
  from: string;
  to: string;
  statusCode?: number;
}) {
  const payload = {
    data: {
      type: "redirect--redirect",
      attributes: {
        redirect_source: { path: params.from.replace(/^\//, "") },
        redirect_redirect: { uri: params.to.startsWith("/") ? `internal:${params.to}` : params.to },
        status_code: params.statusCode || 301,
      },
    },
  };

  const data = await drupalFetch(conn, "/jsonapi/redirect/redirect", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { success: true, id: data?.data?.id };
}

// ─── Action: delete-redirect ────────────────────────────────
async function deleteRedirect(conn: DrupalConnection, params: { redirectId: string }) {
  const url = `${baseUrl(conn)}/jsonapi/redirect/redirect/${params.redirectId}`;
  const res = await fetch(url, { method: "DELETE", headers: buildHeaders(conn) });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete redirect: ${res.status}`);
  }
  return { success: true };
}

// ─── Action: discover-node-types ────────────────────────────
async function discoverNodeTypes(conn: DrupalConnection) {
  const data = await drupalFetch(conn, "/jsonapi");
  const nodeTypes = Object.keys(data?.links || {})
    .filter((key) => key.startsWith("node--"))
    .map((key) => key.replace("node--", ""));
  return { nodeTypes };
}

/** ─── Router ─────────────────────────────────────────────── */

const ACTIONS: Record<string, (conn: DrupalConnection, params: any) => Promise<any>> = {
  "test-connection": testConnection,
  "list-pages": listPages,
  "get-page": getPage,
  "update-meta": updateMeta,
  "update-body": updateBody,
  "add-internal-links": addInternalLinks,
  "list-redirects": listRedirects,
  "create-redirect": createRedirect,
  "delete-redirect": deleteRedirect,
  "discover-node-types": discoverNodeTypes,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const user = await getUserFromRequest(req);
    const { action, tracked_site_id, ...params } = await req.json();

    if (!action || !ACTIONS[action]) {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}. Available: ${Object.keys(ACTIONS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For test-connection with direct credentials (before saving to DB)
    if (action === "test-connection" && params.site_url) {
      const tempConn: DrupalConnection = {
        auth_method: params.auth_method || "basic",
        site_url: params.site_url,
        oauth_access_token: params.oauth_access_token,
        basic_auth_user: params.basic_auth_user,
        basic_auth_pass: params.basic_auth_pass,
        api_key: params.api_key,
      };
      const result = await ACTIONS[action](tempConn, params);
      return new Response(JSON.stringify({ data: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch connection from DB
    if (!tracked_site_id) {
      return new Response(
        JSON.stringify({ error: "tracked_site_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = getServiceClient();
    const { data: conn, error: connError } = await sb
      .from("cms_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("tracked_site_id", tracked_site_id)
      .eq("platform", "drupal")
      .eq("status", "active")
      .single();

    if (connError || !conn) {
      return new Response(
        JSON.stringify({ error: "No active Drupal connection found for this site" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log usage
    await sb.from("analytics_events").insert({
      user_id: user.id,
      event_type: `drupal:${action}`,
      event_data: { tracked_site_id, action },
    });

    const result = await ACTIONS[action](conn as DrupalConnection, params);
    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[drupal-actions]", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: err.message?.includes("Unauthorized") ? 401 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
