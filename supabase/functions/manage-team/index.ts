import { getServiceClient, getUserClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getUserClient(authHeader);
    const adminClient = getServiceClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    // Check user is Pro Agency or Admin
    const { data: profile } = await adminClient
      .from("profiles")
      .select("plan_type, subscription_status")
      .eq("user_id", user.id)
      .single();

    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!adminRole;
    const isAgencyPro = profile?.plan_type === "agency_pro" || profile?.plan_type === "agency_premium";
    const isAgencyPremium = profile?.plan_type === "agency_premium";

    if (!isAdmin && !isAgencyPro) {
      return new Response(
        JSON.stringify({ error: "Pro Agency subscription required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    switch (action) {
      case "create_invitation": {
        const { role, email } = params;
        if (!role || !["owner", "collaborator"].includes(role)) {
          return new Response(
            JSON.stringify({ error: "Invalid role" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Check current team size (max 3 total including owner)
        const { data: members } = await adminClient
          .from("agency_team_members")
          .select("id")
          .eq("owner_user_id", user.id);

        const { data: pendingInvites } = await adminClient
          .from("agency_invitations")
          .select("id")
          .eq("owner_user_id", user.id)
          .eq("status", "pending");

        const totalSlots =
          (members?.length || 0) + (pendingInvites?.length || 0);
        const maxSlots = isAgencyPremium ? 2 : 1; // 3 total for Premium, 2 for Pro
        if (totalSlots >= maxSlots) {
          return new Response(
            JSON.stringify({
              error: `Maximum team size reached (${maxSlots + 1} accounts)`,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Set expiry to 48 hours
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        const { data: invitation, error } = await adminClient
          .from("agency_invitations")
          .insert({
            owner_user_id: user.id,
            role,
            email: email || null,
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ invitation }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "accept_invitation": {
        const { token } = params;
        if (!token) {
          return new Response(
            JSON.stringify({ error: "Token required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: invitation } = await adminClient
          .from("agency_invitations")
          .select("*")
          .eq("token", token)
          .eq("status", "pending")
          .single();

        if (!invitation) {
          return new Response(
            JSON.stringify({ error: "Invalid or expired invitation" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Check not expired
        if (new Date(invitation.expires_at) < new Date()) {
          await adminClient
            .from("agency_invitations")
            .update({ status: "expired" })
            .eq("id", invitation.id);
          return new Response(
            JSON.stringify({ error: "Invitation expired" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Can't join your own team
        if (invitation.owner_user_id === user.id) {
          return new Response(
            JSON.stringify({ error: "Cannot accept your own invitation" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Add as team member
        const { error: memberError } = await adminClient
          .from("agency_team_members")
          .insert({
            owner_user_id: invitation.owner_user_id,
            member_user_id: user.id,
            role: invitation.role,
          });

        if (memberError) {
          if (memberError.code === "23505") {
            return new Response(
              JSON.stringify({ error: "Already a team member" }),
              {
                status: 400,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }
          throw memberError;
        }

        // Mark invitation as accepted
        await adminClient
          .from("agency_invitations")
          .update({ status: "accepted", accepted_by: user.id })
          .eq("id", invitation.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove_member": {
        const { member_id } = params;
        const { error } = await adminClient
          .from("agency_team_members")
          .delete()
          .eq("id", member_id)
          .eq("owner_user_id", user.id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "revoke_invitation": {
        const { invitation_id } = params;
        const { error } = await adminClient
          .from("agency_invitations")
          .delete()
          .eq("id", invitation_id)
          .eq("owner_user_id", user.id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_team": {
        const { data: members } = await adminClient
          .from("agency_team_members")
          .select("*")
          .eq("owner_user_id", user.id);

        // Fetch profiles for member_user_ids
        const memberIds = (members || []).map((m: any) => m.member_user_id);
        let memberProfiles: any[] = [];
        if (memberIds.length > 0) {
          const { data } = await adminClient
            .from("profiles")
            .select("user_id, first_name, last_name, email")
            .in("user_id", memberIds);
          memberProfiles = data || [];
        }

        const { data: invitations } = await adminClient
          .from("agency_invitations")
          .select("*")
          .eq("owner_user_id", user.id)
          .eq("status", "pending");

        return new Response(
          JSON.stringify({
            members: (members || []).map((m: any) => {
              const profile = memberProfiles.find(
                (p: any) => p.user_id === m.member_user_id
              );
              return { ...m, profile };
            }),
            invitations: invitations || [],
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
