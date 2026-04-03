import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * felix-weekly-quiz-notif — Weekly cron that creates a quiz invitation
 * notification for users who haven't taken the quiz recently.
 * 
 * Inserts a "felix_quiz_invite" analytics event so the frontend
 * can show a notification bubble in Félix.
 */

Deno.serve(handleRequest(async (req) => {
const supabase = getServiceClient();

  try {
    // Find users who logged in within last 14 days but haven't done a quiz in 7+ days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Get recently active users
    const { data: activeUsers } = await supabase
      .from('profiles')
      .select('user_id')
      .gte('updated_at', fourteenDaysAgo)
      .limit(500);

    if (!activeUsers || activeUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = activeUsers.map(u => u.user_id);

    // Get users who already did a quiz recently
    const { data: recentQuizUsers } = await supabase
      .from('analytics_events')
      .select('user_id')
      .in('event_type', ['quiz:seo_score', 'quiz:crawlers_score'])
      .gte('created_at', sevenDaysAgo)
      .in('user_id', userIds);

    const recentQuizUserIds = new Set((recentQuizUsers || []).map(u => u.user_id));

    // Get users who already received a notif this week
    const { data: alreadyNotified } = await supabase
      .from('analytics_events')
      .select('user_id')
      .eq('event_type', 'felix:quiz_invite')
      .gte('created_at', sevenDaysAgo)
      .in('user_id', userIds);

    const alreadyNotifiedIds = new Set((alreadyNotified || []).map(u => u.user_id));

    // Filter eligible users
    const eligibleUsers = userIds.filter(
      id => !recentQuizUserIds.has(id) && !alreadyNotifiedIds.has(id)
    );

    if (eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert quiz invite events
    const inserts = eligibleUsers.map(userId => ({
      user_id: userId,
      event_type: 'felix:quiz_invite',
      event_data: {
        message: 'Ça te dit de tester tes connaissances en SEO GEO ? 3 minutes max.',
        created_at: new Date().toISOString(),
      },
    }));

    const { error } = await supabase.from('analytics_events').insert(inserts);
    if (error) throw error;

    console.log(`[felix-weekly-quiz-notif] Notified ${eligibleUsers.length} users`);

    return new Response(JSON.stringify({ success: true, notified: eligibleUsers.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[felix-weekly-quiz-notif] Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}));