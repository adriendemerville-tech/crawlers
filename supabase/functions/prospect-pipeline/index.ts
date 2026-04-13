import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callLovableAIText } from '../_shared/lovableAI.ts';
import { handleRequest } from '../_shared/serveHandler.ts';

/**
 * Edge Function: prospect-pipeline
 * 
 * 100% LinkedIn pipeline with anti-detection rhythm.
 * 
 * Anti-bot strategy:
 * - Max 15-20 invitations/day (randomized between min/max)
 * - Max 30-40 messages/day
 * - Business hours only (8h-19h, timezone-aware)
 * - No weekends
 * - Random delays between actions (45s-180s simulated via next_action_at spacing)
 * - Sequence delays: J+0 invitation → J+2..4 pitch → J+6..9 relance → J+14..18 dernier rappel
 * - Each step has ±30% jitter on delay
 * - Cooldown: no response after 21 days → archive
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ─── Anti-detection constants ───
const ANTI_BOT = {
  // Daily quotas (effective limit randomized each day between min and max)
  INVITATIONS_MIN: 12, INVITATIONS_MAX: 20,
  MESSAGES_MIN: 25, MESSAGES_MAX: 40,
  // Business hours (UTC — adjust for your timezone)
  HOUR_START: 7, HOUR_END: 19,
  // Sequence delays in days [min, max] — random within range per prospect
  DELAYS: {
    invitation_to_pitch: [2, 4],      // J+2..4 after invitation accepted/sent
    pitch_to_followup1: [4, 6],       // J+6..9 total
    followup1_to_followup2: [7, 11],  // J+14..18 total
    cooldown_days: 21,                // Archive after 21 days no response
  },
  // Weekend skip
  SKIP_WEEKENDS: true,
};

// Default LinkedIn-only sequence
const DEFAULT_SEQUENCE = [
  { step: 1, action: 'invitation', label: 'Invitation de connexion', delay_range: [0, 0] },
  { step: 2, action: 'pitch', label: 'Message pitch (avec audit si dispo)', delay_range: ANTI_BOT.DELAYS.invitation_to_pitch },
  { step: 3, action: 'followup_1', label: 'Relance 1', delay_range: ANTI_BOT.DELAYS.pitch_to_followup1 },
  { step: 4, action: 'followup_2', label: 'Dernier rappel', delay_range: ANTI_BOT.DELAYS.followup1_to_followup2 },
];

// ─── Helpers ───
function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function addBusinessDays(from: Date, daysMin: number, daysMax: number): Date {
  const days = randomBetween(daysMin, daysMax);
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (ANTI_BOT.SKIP_WEEKENDS && (dow === 0 || dow === 6)) continue;
    added++;
  }
  // Set to random business hour
  const hour = randomBetween(ANTI_BOT.HOUR_START, ANTI_BOT.HOUR_END - 1);
  const minute = randomBetween(0, 59);
  result.setUTCHours(hour, minute, randomBetween(0, 59));
  return result;
}

function isBusinessTime(): boolean {
  const now = new Date();
  const hour = now.getUTCHours();
  const dow = now.getDay();
  if (ANTI_BOT.SKIP_WEEKENDS && (dow === 0 || dow === 6)) return false;
  return hour >= ANTI_BOT.HOUR_START && hour < ANTI_BOT.HOUR_END;
}

function getDailyLimit(type: 'invitation' | 'message'): number {
  // Randomize daily cap so it's different each day
  if (type === 'invitation') return randomBetween(ANTI_BOT.INVITATIONS_MIN, ANTI_BOT.INVITATIONS_MAX);
  return randomBetween(ANTI_BOT.MESSAGES_MIN, ANTI_BOT.MESSAGES_MAX);
}

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Scoring logic ───
function scoreProspect(prospect: any): { score: number; details: Record<string, number> } {
  const details: Record<string, number> = {};
  const title = (prospect.job_title || '').toLowerCase();
  const titleKeywords: Record<string, number> = {
    'seo': 25, 'référencement': 25, 'search': 20,
    'marketing': 15, 'digital': 15, 'growth': 15,
    'web': 10, 'e-commerce': 15, 'ecommerce': 15,
    'agence': 20, 'agency': 20, 'consultant': 20,
    'freelance': 15, 'directeur': 10, 'head': 10,
    'cmo': 20, 'ceo': 10, 'founder': 10, 'fondateur': 10,
  };
  let titleScore = 0;
  for (const [kw, pts] of Object.entries(titleKeywords)) {
    if (title.includes(kw)) titleScore = Math.max(titleScore, pts);
  }
  details.job_relevance = titleScore;

  const industry = (prospect.industry || '').toLowerCase();
  const industryKeywords: Record<string, number> = {
    'marketing': 15, 'digital': 15, 'tech': 10, 'saas': 15,
    'e-commerce': 15, 'agence': 20, 'agency': 20, 'média': 10,
    'communication': 10, 'web': 10, 'logiciel': 10, 'software': 10,
  };
  let industryScore = 0;
  for (const [kw, pts] of Object.entries(industryKeywords)) {
    if (industry.includes(kw)) industryScore = Math.max(industryScore, pts);
  }
  details.industry_relevance = industryScore;
  details.has_website = prospect.website_url ? 20 : 0;

  if (prospect.last_post_date) {
    const daysSincePost = (Date.now() - new Date(prospect.last_post_date).getTime()) / (1000 * 60 * 60 * 24);
    details.activity_recency = daysSincePost < 7 ? 15 : daysSincePost < 30 ? 10 : daysSincePost < 90 ? 5 : 0;
  } else { details.activity_recency = 0; }

  if (prospect.last_interaction_date) {
    const days = (Date.now() - new Date(prospect.last_interaction_date).getTime()) / (1000 * 60 * 60 * 24);
    details.interaction_recency = days < 7 ? 10 : days < 30 ? 5 : 0;
  } else { details.interaction_recency = 0; }

  return { score: Math.min(100, Object.values(details).reduce((a, b) => a + b, 0)), details };
}

// ─── Message generation (step-aware) ───
async function generateStepMessage(
  prospect: any,
  stepAction: string,
  reportUrl?: string | null,
): Promise<string> {
  const lang = prospect.language || 'fr';
  const firstName = prospect.first_name || '';
  const company = prospect.company || '';

  const langInstructions: Record<string, string> = {
    fr: 'Rédige le message en français. Tutoiement professionnel.',
    en: 'Write in English. Professional but friendly.',
    es: 'Escribe en español. Tono profesional pero cercano.',
  };

  const prompts: Record<string, string> = {
    invitation: `Tu es un expert B2B. ${langInstructions[lang] || langInstructions.fr}
Rédige une NOTE D'INVITATION LinkedIn ultra-courte (max 200 caractères, c'est la limite LinkedIn) pour ${firstName}${company ? ` de ${company}` : ''} (${prospect.job_title || ''}).
- Personnalisée, naturelle, PAS de spam
- Mentionne un point d'intérêt commun (SEO, visibilité digitale)
- NE PAS mentionner d'audit ni de lien
- Juste une raison d'accepter la connexion
Réponds UNIQUEMENT avec le message.`,

    pitch: `Tu es un expert B2B SEO. ${langInstructions[lang] || langInstructions.fr}
Rédige un message LinkedIn (max 300 caractères) pour ${firstName}${company ? ` de ${company}` : ''}.
${reportUrl ? `On a analysé son site — rapport : ${reportUrl}. Mentionne un insight concret. Donne envie de cliquer.` : `On n'a pas son URL. Propose un audit gratuit SEO+IA de son site ou celui d'un concurrent.`}
- Naturel, pas de spam, pas de Crawlers.fr
- Finir par une question ouverte
Réponds UNIQUEMENT avec le message.`,

    followup_1: `Tu es un expert B2B. ${langInstructions[lang] || langInstructions.fr}
Rédige une RELANCE LinkedIn courte (max 250 caractères) pour ${firstName}${company ? ` de ${company}` : ''}.
On lui a déjà envoyé un premier message il y a quelques jours${reportUrl ? ` avec un audit SEO` : ''}.
- Rappeler subtilement la proposition sans être insistant
- Ajouter un nouvel angle de valeur (tendance SEO, IA, concurrent)
- Naturel, PAS de copier-coller évident
Réponds UNIQUEMENT avec le message.`,

    followup_2: `Tu es un expert B2B. ${langInstructions[lang] || langInstructions.fr}
Rédige un DERNIER message LinkedIn (max 200 caractères) pour ${firstName}${company ? ` de ${company}` : ''}.
C'est la dernière relance, on ne le recontactera plus après.
- Ton léger et décontracté, zéro pression
- Mentionner que c'est le dernier message
- Laisser la porte ouverte pour le futur
Réponds UNIQUEMENT avec le message.`,
  };

  const prompt = prompts[stepAction] || prompts.pitch;

  try {
    const result = await callLovableAIText(prompt, {
      model: 'google/gemini-2.5-flash',
      maxTokens: 400,
    });
    return result.text || `Salut ${firstName} !`;
  } catch (e) {
    console.error('Message generation failed:', e);
    return `Salut ${firstName}, j'aimerais échanger avec toi sur la visibilité SEO${company ? ` de ${company}` : ''}. Ça t'intéresse ?`;
  }
}

// ─── Trigger Marina audit ───
async function triggerMarinaAudit(url: string, language: string): Promise<{ jobId?: string; error?: string }> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/marina`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ url, language, source: 'prospect-pipeline' }),
    });
    const data = await resp.json();
    return { jobId: data.job_id || data.jobId };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const body = req.method === 'POST' ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get('action') || '';

    // ─── Webhook Import ───
    if (action === 'webhook_import') {
      const prospects = body.prospects || [];
      if (!Array.isArray(prospects) || prospects.length === 0) return jsonError('prospects array is required');

      const rows = prospects.map((p: any) => ({
        first_name: p.first_name || p.firstName || p.prenom || 'Unknown',
        last_name: p.last_name || p.lastName || p.nom || 'Unknown',
        linkedin_url: p.linkedin_url || p.linkedinUrl || p.profileUrl || null,
        job_title: p.job_title || p.jobTitle || p.headline || null,
        company: p.company || p.companyName || null,
        industry: p.industry || null,
        website_url: p.website_url || p.websiteUrl || p.website || null,
        language: p.language || p.lang || 'fr',
        source: body.source || 'webhook',
        last_post_date: p.last_post_date || null,
        last_interaction_date: p.last_interaction_date || null,
        raw_data: p,
        status: 'new',
      }));

      const { data, error } = await supabase.from('marina_prospects').insert(rows).select('id');
      if (error) return jsonError(error.message, 500);
      return jsonOk({ success: true, imported: (data || []).length });
    }

    // ─── Qualify Batch ───
    if (action === 'qualify_batch') {
      const { data: prospects } = await supabase
        .from('marina_prospects').select('*').eq('status', 'new').limit(100);

      if (!prospects || prospects.length === 0) return jsonOk({ success: true, qualified: 0 });

      let count = 0;
      for (const p of prospects) {
        const { score, details } = scoreProspect(p);
        await supabase.from('marina_prospects')
          .update({ score, score_details: details, status: score >= 30 ? 'qualified' : 'low_score' })
          .eq('id', p.id);
        count++;
      }
      return jsonOk({ success: true, qualified: count });
    }

    // ─── Prepare Outreach (Step 1: invitation) ───
    if (action === 'prepare_outreach') {
      const { data: prospects } = await supabase
        .from('marina_prospects').select('*')
        .eq('status', 'qualified')
        .order('score', { ascending: false })
        .limit(body.limit || 10);

      if (!prospects || prospects.length === 0) return jsonOk({ success: true, prepared: 0 });

      let count = 0;
      for (const p of prospects) {
        // Trigger Marina audit if URL available (runs in background)
        if (p.website_url) {
          const { jobId } = await triggerMarinaAudit(p.website_url, p.language || 'fr');
          if (jobId) {
            await supabase.from('marina_prospects').update({ marina_audit_id: jobId }).eq('id', p.id);
          }
        }

        // Generate invitation note
        const message = await generateStepMessage(p, 'invitation');

        // Calculate when step 2 (pitch) should fire — business days + jitter
        const nextActionAt = addBusinessDays(
          new Date(), 
          ANTI_BOT.DELAYS.invitation_to_pitch[0], 
          ANTI_BOT.DELAYS.invitation_to_pitch[1]
        );

        await supabase.from('prospect_outreach_queue').insert({
          prospect_id: p.id,
          step_number: 1,
          channel: 'linkedin',
          message_type: 'invitation',
          message_content: message,
          message_language: p.language || 'fr',
          status: 'ready',
          next_action_at: nextActionAt.toISOString(),
        });

        await supabase.from('marina_prospects').update({ status: 'contacted' }).eq('id', p.id);
        count++;
      }
      return jsonOk({ success: true, prepared: count });
    }

    // ─── Finalize Pending (check Marina results) ───
    if (action === 'finalize_pending') {
      const { data: pending } = await supabase
        .from('prospect_outreach_queue')
        .select('*, marina_prospects!prospect_outreach_queue_prospect_id_fkey(*)')
        .eq('status', 'pending').limit(50);

      if (!pending || pending.length === 0) return jsonOk({ success: true, finalized: 0 });

      let count = 0;
      for (const item of pending as any[]) {
        const prospect = item.marina_prospects;
        if (!prospect?.marina_audit_id) continue;

        const { data: job } = await supabase.from('async_jobs')
          .select('status, result_data').eq('id', prospect.marina_audit_id).maybeSingle();

        if (job?.status === 'completed' && job.result_data) {
          const reportUrl = (job.result_data as any).report_url || (job.result_data as any).reportUrl;
          if (reportUrl) {
            const message = await generateStepMessage(prospect, 'pitch', reportUrl);
            await supabase.from('prospect_outreach_queue')
              .update({ status: 'ready', message_content: message, report_share_url: reportUrl })
              .eq('id', item.id);
            await supabase.from('marina_prospects')
              .update({ marina_report_url: reportUrl }).eq('id', prospect.id);
            count++;
          }
        } else if (job?.status === 'failed') {
          const message = await generateStepMessage(prospect, 'pitch');
          await supabase.from('prospect_outreach_queue')
            .update({ status: 'ready', message_type: 'pitch', message_content: message })
            .eq('id', item.id);
          count++;
        }
      }
      return jsonOk({ success: true, finalized: count });
    }

    // ─── Advance Sequence: LinkedIn only, anti-bot timing ───
    if (action === 'advance_sequence') {
      // Only run during business hours
      if (!isBusinessTime()) {
        return jsonOk({ success: true, advanced: 0, message: 'Outside business hours — skipped' });
      }

      const now = new Date();
      const { data: dueItems } = await supabase
        .from('prospect_outreach_queue')
        .select('*, marina_prospects!prospect_outreach_queue_prospect_id_fkey(*)')
        .eq('status', 'sent')
        .lte('next_action_at', now.toISOString())
        .not('next_action_at', 'is', null)
        .order('next_action_at', { ascending: true })
        .limit(30);

      if (!dueItems || dueItems.length === 0) return jsonOk({ success: true, advanced: 0 });

      const steps = DEFAULT_SEQUENCE;
      let advancedCount = 0;

      for (const item of dueItems as any[]) {
        const prospect = item.marina_prospects;
        if (!prospect) continue;

        const currentStep = item.step_number || 1;

        // Cooldown check: if step 1 was sent > 21 days ago with no reply → archive
        if (currentStep >= 4) {
          await supabase.from('prospect_outreach_queue')
            .update({ status: 'sequence_complete', next_action_at: null }).eq('id', item.id);
          await supabase.from('outreach_events').insert({
            prospect_id: prospect.id, queue_item_id: item.id,
            user_id: prospect.user_id || '00000000-0000-0000-0000-000000000000',
            event_type: 'sequence_completed', channel: 'linkedin',
          });
          advancedCount++;
          continue;
        }

        const nextStepDef = steps.find(s => s.step === currentStep + 1);
        if (!nextStepDef) continue;

        // Generate message for next step
        const messageContent = await generateStepMessage(
          prospect, nextStepDef.action, prospect.marina_report_url
        );

        // Calculate next action: business days + jitter
        const delayRange = nextStepDef.step < steps.length
          ? steps[nextStepDef.step]?.delay_range || [5, 8]
          : [0, 0];
        const nextActionAt = delayRange[0] > 0 || delayRange[1] > 0
          ? addBusinessDays(now, delayRange[0], delayRange[1]).toISOString()
          : null;

        // Create next step
        await supabase.from('prospect_outreach_queue').insert({
          prospect_id: prospect.id,
          step_number: nextStepDef.step,
          channel: 'linkedin',
          sequence_id: item.sequence_id,
          message_type: nextStepDef.action,
          message_content: messageContent,
          message_language: prospect.language || 'fr',
          report_share_url: prospect.marina_report_url || null,
          status: 'ready',
          next_action_at: nextActionAt,
        });

        // Mark old item as advanced
        await supabase.from('prospect_outreach_queue')
          .update({ status: 'advanced', next_action_at: null }).eq('id', item.id);

        await supabase.from('outreach_events').insert({
          prospect_id: prospect.id, queue_item_id: item.id,
          user_id: prospect.user_id || '00000000-0000-0000-0000-000000000000',
          event_type: 'step_advanced', channel: 'linkedin',
          metadata: { from_step: currentStep, to_step: nextStepDef.step, action: nextStepDef.action },
        });
        advancedCount++;
      }

      return jsonOk({ success: true, advanced: advancedCount });
    }

    // ─── Cooldown: archive prospects with no response after N days ───
    if (action === 'apply_cooldown') {
      const cutoff = new Date(Date.now() - ANTI_BOT.DELAYS.cooldown_days * 86400000).toISOString();
      const { data: stale } = await supabase
        .from('prospect_outreach_queue')
        .select('id, prospect_id')
        .eq('status', 'sent')
        .lt('sent_at', cutoff)
        .limit(100);

      if (!stale || stale.length === 0) return jsonOk({ success: true, archived: 0 });

      let count = 0;
      for (const item of stale) {
        await supabase.from('prospect_outreach_queue')
          .update({ status: 'expired', next_action_at: null }).eq('id', item.id);
        await supabase.from('marina_prospects')
          .update({ status: 'lost' }).eq('id', item.prospect_id);
        count++;
      }
      return jsonOk({ success: true, archived: count });
    }

    // ─── List prospects ───
    if (action === 'list') {
      const status = body.status || url.searchParams.get('status');
      const limit = parseInt(body.limit || url.searchParams.get('limit') || '50');
      let query = supabase.from('marina_prospects')
        .select('*, prospect_outreach_queue(*)').order('score', { ascending: false }).limit(limit);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) return jsonError(error.message, 500);
      return jsonOk({ success: true, prospects: data || [] });
    }

    // ─── Update status (mark as sent/replied) ───
    if (action === 'update_status') {
      const { prospect_id, status, outreach_id } = body;
      if (!prospect_id && !outreach_id) return jsonError('prospect_id or outreach_id required');

      if (prospect_id) {
        await supabase.from('marina_prospects').update({ status }).eq('id', prospect_id);
      }
      if (outreach_id) {
        const updates: any = { status };
        if (status === 'sent') updates.sent_at = new Date().toISOString();
        if (status === 'replied') {
          updates.replied_at = new Date().toISOString();
          updates.next_action_at = null; // Stop sequence on reply
        }
        await supabase.from('prospect_outreach_queue').update(updates).eq('id', outreach_id);

        // If replied, pause all future steps for this prospect
        if (status === 'replied' && prospect_id) {
          await supabase.from('prospect_outreach_queue')
            .update({ status: 'paused_reply', next_action_at: null })
            .eq('prospect_id', prospect_id)
            .eq('status', 'ready');
          
          await supabase.from('marina_prospects').update({ status: 'replied' }).eq('id', prospect_id);
          
          await supabase.from('outreach_events').insert({
            prospect_id, queue_item_id: outreach_id,
            user_id: '00000000-0000-0000-0000-000000000000',
            event_type: 'replied_manually', channel: 'linkedin',
          });
        }
      }
      return jsonOk({ success: true });
    }

    // ─── Get daily quotas ───
    if (action === 'get_quotas') {
      const userId = body.user_id;
      if (!userId) return jsonError('user_id required');
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('outreach_daily_quotas')
        .select('*').eq('user_id', userId).eq('quota_date', today).maybeSingle();
      
      // Today's randomized limits
      const maxInv = getDailyLimit('invitation');
      const maxMsg = getDailyLimit('message');
      return jsonOk({
        success: true,
        quotas: data || { invitations_sent: 0, messages_sent: 0, quota_date: today },
        limits: { max_invitations: maxInv, max_messages: maxMsg },
        is_business_hours: isBusinessTime(),
      });
    }

    // ─── Increment quota (called when user marks as sent) ───
    if (action === 'increment_quota') {
      const userId = body.user_id;
      const quotaType = body.type; // 'invitation' or 'message'
      if (!userId || !quotaType) return jsonError('user_id and type required');

      if (!isBusinessTime()) {
        return jsonOk({ success: false, blocked: true, reason: 'outside_business_hours' });
      }

      const today = new Date().toISOString().split('T')[0];
      const maxToday = getDailyLimit(quotaType);

      const { data: existing } = await supabase.from('outreach_daily_quotas')
        .select('*').eq('user_id', userId).eq('quota_date', today).maybeSingle();

      if (existing) {
        const field = quotaType === 'invitation' ? 'invitations_sent' : 'messages_sent';
        const current = (existing as any)[field] || 0;
        if (current >= maxToday) {
          return jsonOk({ success: false, quota_exceeded: true, current, max: maxToday });
        }
        await supabase.from('outreach_daily_quotas')
          .update({ [field]: current + 1 }).eq('id', existing.id);
        return jsonOk({ success: true, current: current + 1, max: maxToday, remaining: maxToday - current - 1 });
      } else {
        const field = quotaType === 'invitation' ? 'invitations_sent' : 'messages_sent';
        await supabase.from('outreach_daily_quotas').insert({
          user_id: userId, quota_date: today, [field]: 1,
        });
        return jsonOk({ success: true, current: 1, max: maxToday });
      }
    }

    // ─── Get sequence config ───
    if (action === 'get_sequence') {
      return jsonOk({
        success: true,
        sequence: DEFAULT_SEQUENCE,
        anti_bot: {
          invitations_range: [ANTI_BOT.INVITATIONS_MIN, ANTI_BOT.INVITATIONS_MAX],
          messages_range: [ANTI_BOT.MESSAGES_MIN, ANTI_BOT.MESSAGES_MAX],
          business_hours: `${ANTI_BOT.HOUR_START}h-${ANTI_BOT.HOUR_END}h UTC`,
          skip_weekends: ANTI_BOT.SKIP_WEEKENDS,
          cooldown_days: ANTI_BOT.DELAYS.cooldown_days,
        },
      });
    }

    // ─── Nightly run (full pipeline) ───
    if (action === 'nightly_run') {
      const results: Record<string, any> = {};

      for (const step of ['qualify_batch', 'prepare_outreach', 'finalize_pending', 'advance_sequence', 'apply_cooldown']) {
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/prospect-pipeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({ action: step, limit: 15 }),
          });
          results[step] = await resp.json();
        } catch (e: any) {
          results[step] = { error: e.message };
        }
      }

      return jsonOk({ success: true, nightly_run: results });
    }

    return jsonError('Unknown action. Use: webhook_import, qualify_batch, prepare_outreach, finalize_pending, advance_sequence, apply_cooldown, get_quotas, increment_quota, get_sequence, list, update_status, nightly_run');
  } catch (e: any) {
    console.error('prospect-pipeline error:', e);
    return jsonError(e.message || 'Internal error', 500);
  }
}, 'prospect-pipeline'))
