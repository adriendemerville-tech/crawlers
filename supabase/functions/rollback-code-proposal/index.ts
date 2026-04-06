import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GITHUB_API = "https://api.github.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { deployment_id } = await req.json();
    if (!deployment_id) {
      return new Response(JSON.stringify({ error: "deployment_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get deployment record
    const { data: deployment, error: fetchErr } = await supabase
      .from("code_deployment_history")
      .select("*")
      .eq("id", deployment_id)
      .eq("is_rolled_back", false)
      .single();

    if (fetchErr || !deployment) {
      return new Response(JSON.stringify({ error: "Deployment not found or already rolled back" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!deployment.previous_content) {
      return new Response(JSON.stringify({ error: "No previous content available for rollback" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
    const GITHUB_REPO = Deno.env.get("GITHUB_REPO");

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return new Response(JSON.stringify({ error: "GitHub not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ghHeaders = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Crawlers-Bridge",
    };

    // Get current file SHA
    const getFileRes = await fetch(
      `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${deployment.file_path}`,
      { headers: ghHeaders }
    );

    if (!getFileRes.ok) {
      const errText = await getFileRes.text();
      return new Response(JSON.stringify({ error: "File not found on GitHub", details: errText }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileData = await getFileRes.json();

    // Commit the rollback
    const commitMessage = `[ROLLBACK] Revert ${deployment.agent_source?.toUpperCase()}-agent change on ${deployment.file_path}\n\nRolling back deployment ${deployment_id}\nOriginal commit: ${deployment.commit_sha}`;

    const putRes = await fetch(
      `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${deployment.file_path}`,
      {
        method: "PUT",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: commitMessage,
          content: btoa(unescape(encodeURIComponent(deployment.previous_content))),
          sha: fileData.sha,
          branch: "main",
        }),
      }
    );

    const putData = await putRes.json();

    if (!putRes.ok) {
      console.error("GitHub rollback error:", putData);
      return new Response(
        JSON.stringify({ error: "GitHub rollback failed", details: putData.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as rolled back
    await supabase
      .from("code_deployment_history")
      .update({
        is_rolled_back: true,
        rolled_back_at: new Date().toISOString(),
        rolled_back_by: user.id,
        rollback_commit_sha: putData.commit?.sha || null,
      })
      .eq("id", deployment_id);

    return new Response(
      JSON.stringify({
        success: true,
        rollback_commit_sha: putData.commit?.sha,
        rollback_commit_url: putData.commit?.html_url,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Rollback error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
