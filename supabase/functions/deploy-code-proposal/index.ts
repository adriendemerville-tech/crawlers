import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const GITHUB_API = "https://api.github.com";

Deno.serve(handleRequest(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
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

    // Verify user is admin
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

    // Parse body
    const { proposal_id } = await req.json();
    if (!proposal_id) {
      return new Response(JSON.stringify({ error: "proposal_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get proposal
    const { data: proposal, error: fetchErr } = await supabase
      .from("cto_code_proposals")
      .select("*")
      .eq("id", proposal_id)
      .eq("status", "approved")
      .single();

    if (fetchErr || !proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found or not approved" }), {
        status: 404,
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

    const targetFile = proposal.target_function;
    const proposedCode = proposal.proposed_code;

    if (!proposedCode || !targetFile) {
      return new Response(JSON.stringify({ error: "No code or target file in proposal" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Get current file SHA (if exists)
    const ghHeaders = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Crawlers-Bridge",
    };

    let fileSha: string | null = null;
    const getFileRes = await fetch(
      `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${targetFile}`,
      { headers: ghHeaders }
    );

    if (getFileRes.ok) {
      const fileData = await getFileRes.json();
      fileSha = fileData.sha;
    } else {
      await getFileRes.text(); // consume body
    }

    // Step 2: Create/Update file via GitHub API
    const agentSource = (proposal as any).agent_source || "cto";
    const commitMessage = `[${agentSource.toUpperCase()}-agent] ${proposal.title}\n\nProposal: ${proposal_id}\nDomain: ${proposal.domain}\nType: ${proposal.proposal_type}\nConfidence: ${proposal.confidence_score}%`;

    const body: Record<string, unknown> = {
      message: commitMessage,
      content: btoa(unescape(encodeURIComponent(proposedCode))),
      branch: "main",
    };

    if (fileSha) {
      body.sha = fileSha;
    }

    const putRes = await fetch(
      `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${targetFile}`,
      {
        method: "PUT",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    const putData = await putRes.json();

    if (!putRes.ok) {
      console.error("GitHub API error:", putData);
      return new Response(
        JSON.stringify({ error: "GitHub commit failed", details: putData.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Save deployment history (with previous content for rollback)
    let previousContent: string | null = null;
    if (fileSha && getFileRes.ok) {
      // Re-fetch to get the content before our change
      try {
        const prevRes = await fetch(
          `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${targetFile}?ref=${putData.commit?.parents?.[0]?.sha || 'main'}`,
          { headers: ghHeaders }
        );
        if (prevRes.ok) {
          const prevData = await prevRes.json();
          previousContent = prevData.content ? decodeURIComponent(escape(atob(prevData.content.replace(/\n/g, '')))) : null;
        } else {
          await prevRes.text();
        }
      } catch (e) {
        console.warn("Could not fetch previous content:", e);
      }
    }

    await supabase.from("code_deployment_history").insert({
      proposal_id: proposal_id,
      agent_source: agentSource,
      file_path: targetFile,
      previous_content: previousContent,
      deployed_content: proposedCode,
      commit_sha: putData.commit?.sha || null,
      deployed_at: new Date().toISOString(),
    });

    // Step 4: Mark proposal as deployed
    await supabase
      .from("cto_code_proposals")
      .update({
        status: "deployed",
        deployed_at: new Date().toISOString(),
      })
      .eq("id", proposal_id);

    return new Response(
      JSON.stringify({
        success: true,
        commit_sha: putData.commit?.sha,
        commit_url: putData.commit?.html_url,
        file_url: putData.content?.html_url,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Deploy error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}, 'deploy-code-proposal'))
