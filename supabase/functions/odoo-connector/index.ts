import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts'
import { corsHeaders } from '../_shared/cors.ts'

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Missing authorization header");
  const supabase = getUserClient(authHeader);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

/**
 * Odoo XML-RPC helpers
 * Odoo exposes two main XML-RPC endpoints:
 *   - /xmlrpc/2/common  → authenticate
 *   - /xmlrpc/2/object  → execute_kw (CRUD)
 * 
 * For newer Odoo 17+ instances, REST JSON API is also available:
 *   - /api/{model}
 */

function buildXmlRpcPayload(method: string, params: unknown[]): string {
  function toXmlValue(val: unknown): string {
    if (typeof val === "string") return `<value><string>${val}</string></value>`;
    if (typeof val === "number") return Number.isInteger(val)
      ? `<value><int>${val}</int></value>`
      : `<value><double>${val}</double></value>`;
    if (typeof val === "boolean") return `<value><boolean>${val ? 1 : 0}</boolean></value>`;
    if (val === null || val === undefined) return `<value><nil/></value>`;
    if (Array.isArray(val)) {
      return `<value><array><data>${val.map(toXmlValue).join("")}</data></array></value>`;
    }
    if (typeof val === "object") {
      const members = Object.entries(val as Record<string, unknown>)
        .map(([k, v]) => `<member><name>${k}</name>${toXmlValue(v)}</member>`)
        .join("");
      return `<value><struct>${members}</struct></value>`;
    }
    return `<value><string>${String(val)}</string></value>`;
  }

  const paramsXml = params.map(p => `<param>${toXmlValue(p)}</param>`).join("");
  return `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${paramsXml}</params></methodCall>`;
}

function parseXmlRpcResponse(xml: string): unknown {
  // Simplified parser — extracts first <value> content
  const stringMatch = xml.match(/<string>(.*?)<\/string>/s);
  if (stringMatch) return stringMatch[1];
  const intMatch = xml.match(/<int>(\d+)<\/int>/);
  if (intMatch) return parseInt(intMatch[1]);
  const boolMatch = xml.match(/<boolean>([01])<\/boolean>/);
  if (boolMatch) return boolMatch[1] === "1";
  // Fault
  const faultMatch = xml.match(/<fault>.*?<string>(.*?)<\/string>/s);
  if (faultMatch) throw new Error(`Odoo XML-RPC fault: ${faultMatch[1]}`);
  return xml;
}

async function odooAuthenticate(url: string, db: string, login: string, password: string): Promise<number> {
  const body = buildXmlRpcPayload("authenticate", [db, login, password, {}]);
  const res = await fetch(`${url}/xmlrpc/2/common`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body,
  });
  if (!res.ok) throw new Error(`Odoo auth failed [${res.status}]`);
  const xml = await res.text();
  const uid = parseXmlRpcResponse(xml);
  if (typeof uid !== "number" || uid <= 0) throw new Error("Odoo authentication failed — invalid credentials");
  return uid;
}

async function odooExecute(
  url: string, db: string, uid: number, password: string,
  model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}
): Promise<unknown> {
  const body = buildXmlRpcPayload("execute_kw", [db, uid, password, model, method, args, kwargs]);
  const res = await fetch(`${url}/xmlrpc/2/object`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body,
  });
  if (!res.ok) throw new Error(`Odoo execute_kw failed [${res.status}]`);
  const xml = await res.text();
  return parseXmlRpcResponse(xml);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await getUserFromRequest(req);
    const { action, tracked_site_id, odoo_url, odoo_db, odoo_login, odoo_password, odoo_api_key } = await req.json();

    const service = getServiceClient();

    // ─── Test Connection ───
    if (action === "test_connection") {
      if (!odoo_url || !odoo_db || !odoo_login || !odoo_password) {
        return new Response(JSON.stringify({ error: "odoo_url, odoo_db, odoo_login, odoo_password required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanUrl = odoo_url.replace(/\/+$/, "");
      const uid = await odooAuthenticate(cleanUrl, odoo_db, odoo_login, odoo_password);

      // Try to read version info
      const versionRes = await fetch(`${cleanUrl}/xmlrpc/2/common`, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        body: buildXmlRpcPayload("version", []),
      });
      const versionXml = await versionRes.text();

      return new Response(JSON.stringify({
        success: true,
        uid,
        version_info: versionXml.includes("<string>") ? parseXmlRpcResponse(versionXml) : "unknown",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Save Connection ───
    if (action === "save_connection") {
      if (!tracked_site_id || !odoo_url || !odoo_db || !odoo_login || !odoo_password) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanUrl = odoo_url.replace(/\/+$/, "");

      // Verify credentials first
      const uid = await odooAuthenticate(cleanUrl, odoo_db, odoo_login, odoo_password);

      // Upsert CMS connection
      const { error: upsertErr } = await service
        .from("cms_connections")
        .upsert({
          user_id: user.id,
          tracked_site_id,
          platform: "odoo",
          site_url: cleanUrl,
          auth_method: odoo_api_key ? "api_key" : "basic",
          basic_auth_user: odoo_login,
          basic_auth_pass: odoo_password,
          api_key: odoo_api_key || null,
          platform_site_id: odoo_db,
          status: "active",
          capabilities: {
            uid,
            db: odoo_db,
            models: ["website.page", "blog.post", "product.template"],
          },
        }, { onConflict: "tracked_site_id,user_id,platform" });

      if (upsertErr) throw upsertErr;

      return new Response(JSON.stringify({ success: true, uid }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── List Pages ───
    if (action === "list_pages") {
      const conn = await getConnection(service, user.id, tracked_site_id);
      const uid = conn.capabilities?.uid;
      if (!uid) throw new Error("No Odoo UID — reconnect");

      const result = await odooExecute(
        conn.site_url, conn.platform_site_id!, uid, conn.basic_auth_pass!,
        "website.page", "search_read",
        [[]],
        { fields: ["name", "url", "is_published", "write_date"], limit: 100 }
      );

      return new Response(JSON.stringify({ success: true, pages: result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── List Blog Posts ───
    if (action === "list_blog_posts") {
      const conn = await getConnection(service, user.id, tracked_site_id);
      const uid = conn.capabilities?.uid;
      if (!uid) throw new Error("No Odoo UID — reconnect");

      const result = await odooExecute(
        conn.site_url, conn.platform_site_id!, uid, conn.basic_auth_pass!,
        "blog.post", "search_read",
        [[]],
        { fields: ["name", "subtitle", "website_url", "is_published", "write_date"], limit: 50 }
      );

      return new Response(JSON.stringify({ success: true, posts: result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Create Blog Post (Draft) ───
    if (action === "create_draft") {
      const conn = await getConnection(service, user.id, tracked_site_id);
      const uid = conn.capabilities?.uid;
      if (!uid) throw new Error("No Odoo UID — reconnect");

      const { title, content, subtitle } = await req.json().catch(() => ({}));

      const postId = await odooExecute(
        conn.site_url, conn.platform_site_id!, uid, conn.basic_auth_pass!,
        "blog.post", "create",
        [{ name: title || "Draft", subtitle: subtitle || "", content: content || "", is_published: false }]
      );

      return new Response(JSON.stringify({ success: true, post_id: postId }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[odoo-connector]", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getConnection(service: any, userId: string, trackedSiteId: string) {
  const { data, error } = await service
    .from("cms_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("tracked_site_id", trackedSiteId)
    .eq("platform", "odoo")
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) throw new Error("No active Odoo connection found");
  return data;
}
