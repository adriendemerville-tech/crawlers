import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { callLovableAIText } from '../_shared/lovableAI.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

/**
 * Edge Function: prospect-pipeline
 * 
 * Actions:
 * - webhook_import: receive prospects from external tools (Waalaxy, PhantomBuster, CSV)
 * - qualify_batch: score and qualify all 'new' prospects
 * - prepare_outreach: generate Marina audits + messages for qualified prospects
 * - list: list prospects with filters
 * - update_status: mark prospect as sent/replied/converted
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// ─── Scoring logic ───
function scoreProspect(prospect: any): { score: number; details: Record<string, number> } {
  const details: Record<string, number> = {};

  // Job title relevance (SEO, marketing, digital, web, agency)
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

  // Industry relevance
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

  // Has website URL (can run Marina audit)
  details.has_website = prospect.website_url ? 20 : 0;

  // Recent activity (last post < 30 days = active)
  if (prospect.last_post_date) {
    const daysSincePost = (Date.now() - new Date(prospect.last_post_date).getTime()) / (1000 * 60 * 60 * 24);
    details.activity_recency = daysSincePost < 7 ? 15 : daysSincePost < 30 ? 10 : daysSincePost < 90 ? 5 : 0;
  } else {
    details.activity_recency = 0;
  }

  // Recent interaction
  if (prospect.last_interaction_date) {
    const daysSinceInteraction = (Date.now() - new Date(prospect.last_interaction_date).getTime()) / (1000 * 60 * 60 * 24);
    details.interaction_recency = daysSinceInteraction < 7 ? 10 : daysSinceInteraction < 30 ? 5 : 0;
  } else {
    details.interaction_recency = 0;
  }

  const score = Math.min(100, Object.values(details).reduce((a, b) => a + b, 0));
  return { score, details };
}

// ─── Message generation ───
async function generateMessage(prospect: any, type: 'audit_ready' | 'ask_url', reportUrl?: string): Promise<string> {
  const lang = prospect.language || 'fr';
  const firstName = prospect.first_name || '';
  const company = prospect.company || '';

  const langInstructions: Record<string, string> = {
    fr: 'Rédige le message en français. Utilise le tutoiement professionnel.',
    en: 'Write the message in English. Keep it professional but friendly.',
    es: 'Escribe el mensaje en español. Mantén un tono profesional pero cercano.',
  };

  let prompt = '';
  if (type === 'audit_ready') {
    prompt = `Tu es un expert en prospection B2B pour une plateforme d'audit SEO/GEO appelée Crawlers.fr.
${langInstructions[lang] || langInstructions.fr}

Rédige un message LinkedIn court (max 300 caractères) pour ${firstName}${company ? ` de ${company}` : ''}.
On a analysé son site et préparé un rapport d'audit complet (SEO + visibilité IA).
Le lien du rapport est : ${reportUrl}

Le message doit :
- Être personnalisé et naturel (pas de spam)
- Mentionner un insight concret tiré de l'audit
- Donner envie de cliquer sur le lien
- Ne PAS mentionner Crawlers.fr directement dans le premier message
- Finir par une question ouverte

Réponds UNIQUEMENT avec le message, sans guillemets ni explication.`;
  } else {
    prompt = `Tu es un expert en prospection B2B pour une plateforme d'audit SEO/GEO.
${langInstructions[lang] || langInstructions.fr}

Rédige un message LinkedIn court (max 250 caractères) pour ${firstName}${company ? ` de ${company}` : ''} (poste : ${prospect.job_title || 'inconnu'}).
On n'a PAS son URL de site web. L'objectif est d'obtenir une URL (son site, celui d'un client ou d'un concurrent) pour réaliser un audit gratuit.

Le message doit :
- Être personnalisé et naturel
- Proposer un audit gratuit en échange d'une URL
- Mentionner qu'on peut analyser un concurrent aussi
- Être engageant sans être insistant

Réponds UNIQUEMENT avec le message, sans guillemets ni explication.`;
  }

  try {
    const result = await callLovableAIText(prompt, {
      model: 'google/gemini-2.5-flash',
      maxTokens: 500,
    });
    return result.text || '';
  } catch (e) {
    console.error('Message generation failed:', e);
    // Fallback templates
    if (type === 'audit_ready') {
      if (lang === 'en') return `Hi ${firstName}, I ran a quick SEO & AI visibility analysis on your site — found some interesting insights. Here's the report: ${reportUrl} — what do you think?`;
      if (lang === 'es') return `Hola ${firstName}, hice un análisis rápido de SEO y visibilidad IA de tu sitio — encontré cosas interesantes. Aquí está el informe: ${reportUrl} — ¿qué te parece?`;
      return `Salut ${firstName}, j'ai analysé ton site en SEO et visibilité IA — des insights intéressants. Voici le rapport : ${reportUrl} — qu'en penses-tu ?`;
    } else {
      if (lang === 'en') return `Hi ${firstName}, I'm offering free SEO & AI visibility audits — I can analyze your site, a client's, or even a competitor's. Interested?`;
      if (lang === 'es') return `Hola ${firstName}, ofrezco auditorías gratuitas de SEO y visibilidad IA — puedo analizar tu sitio, el de un cliente o incluso un competidor. ¿Te interesa?`;
      return `Salut ${firstName}, je propose des audits gratuits SEO + visibilité IA — je peux analyser ton site, celui d'un client ou même d'un concurrent. Ça t'intéresse ?`;
    }
  }
}

// ─── Trigger Marina audit ───
async function triggerMarinaAudit(url: string, language: string): Promise<{ jobId?: string; error?: string }> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/marina`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ url, language, source: 'prospect-pipeline' }),
    });
    const data = await resp.json();
    return { jobId: data.job_id || data.jobId };
  } catch (e: any) {
    return { error: e.message };
  }
}

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(handleRequest(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const body = req.method === 'POST' ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get('action') || '';

    // ─── Webhook Import (from Waalaxy, PhantomBuster, etc.) ───
    if (action === 'webhook_import') {
      const prospects = body.prospects || [];
      if (!Array.isArray(prospects) || prospects.length === 0) {
        return jsonError('prospects array is required');
      }

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

    // ─── Qualify Batch: score all 'new' prospects ───
    if (action === 'qualify_batch') {
      const { data: prospects } = await supabase
        .from('marina_prospects')
        .select('*')
        .eq('status', 'new')
        .limit(100);

      if (!prospects || prospects.length === 0) {
        return jsonOk({ success: true, qualified: 0, message: 'No new prospects to qualify' });
      }

      let qualifiedCount = 0;
      for (const p of prospects) {
        const { score, details } = scoreProspect(p);
        await supabase
          .from('marina_prospects')
          .update({ score, score_details: details, status: score >= 30 ? 'qualified' : 'low_score' })
          .eq('id', p.id);
        qualifiedCount++;
      }

      return jsonOk({ success: true, qualified: qualifiedCount });
    }

    // ─── Prepare Outreach: generate audits + messages ───
    if (action === 'prepare_outreach') {
      const { data: prospects } = await supabase
        .from('marina_prospects')
        .select('*')
        .eq('status', 'qualified')
        .order('score', { ascending: false })
        .limit(body.limit || 10);

      if (!prospects || prospects.length === 0) {
        return jsonOk({ success: true, prepared: 0, message: 'No qualified prospects to prepare' });
      }

      let preparedCount = 0;
      for (const p of prospects) {
        let messageType: 'audit_ready' | 'ask_url' = p.website_url ? 'audit_ready' : 'ask_url';
        let reportUrl: string | undefined;

        // Trigger Marina audit if URL available
        if (p.website_url && messageType === 'audit_ready') {
          const { jobId } = await triggerMarinaAudit(p.website_url, p.language || 'fr');
          if (jobId) {
            await supabase
              .from('marina_prospects')
              .update({ marina_audit_id: jobId })
              .eq('id', p.id);
            // Note: report URL will be available after Marina completes
            // For now, mark as processing — CRON will check later
          }
        }

        // Generate personalized message
        const message = await generateMessage(p, messageType, reportUrl);

        // Insert into outreach queue
        await supabase.from('prospect_outreach_queue').insert({
          prospect_id: p.id,
          message_type: messageType,
          message_content: message,
          message_language: p.language || 'fr',
          report_share_url: reportUrl || null,
          status: messageType === 'ask_url' ? 'ready' : 'pending',
        });

        await supabase
          .from('marina_prospects')
          .update({ status: 'contacted' })
          .eq('id', p.id);

        preparedCount++;
      }

      return jsonOk({ success: true, prepared: preparedCount });
    }

    // ─── Check Marina results & finalize pending outreach ───
    if (action === 'finalize_pending') {
      const { data: pending } = await supabase
        .from('prospect_outreach_queue')
        .select('*, marina_prospects!prospect_outreach_queue_prospect_id_fkey(*)')
        .eq('status', 'pending')
        .limit(50);

      if (!pending || pending.length === 0) {
        return jsonOk({ success: true, finalized: 0 });
      }

      let finalizedCount = 0;
      for (const item of pending as any[]) {
        const prospect = item.marina_prospects;
        if (!prospect?.marina_audit_id) continue;

        // Check if Marina job completed
        const { data: job } = await supabase
          .from('async_jobs')
          .select('status, result_data')
          .eq('id', prospect.marina_audit_id)
          .maybeSingle();

        if (job?.status === 'completed' && job.result_data) {
          const result = job.result_data as any;
          const reportUrl = result.report_url || result.reportUrl;

          if (reportUrl) {
            // Regenerate message with actual report URL
            const message = await generateMessage(prospect, 'audit_ready', reportUrl);
            await supabase
              .from('prospect_outreach_queue')
              .update({
                status: 'ready',
                message_content: message,
                report_share_url: reportUrl,
              })
              .eq('id', item.id);

            await supabase
              .from('marina_prospects')
              .update({ marina_report_url: reportUrl })
              .eq('id', prospect.id);

            finalizedCount++;
          }
        } else if (job?.status === 'failed') {
          // Fallback to ask_url if Marina failed
          const message = await generateMessage(prospect, 'ask_url');
          await supabase
            .from('prospect_outreach_queue')
            .update({
              status: 'ready',
              message_type: 'ask_url',
              message_content: message,
            })
            .eq('id', item.id);
          finalizedCount++;
        }
      }

      return jsonOk({ success: true, finalized: finalizedCount });
    }

    // ─── List prospects ───
    if (action === 'list') {
      const status = body.status || url.searchParams.get('status');
      const limit = parseInt(body.limit || url.searchParams.get('limit') || '50');
      
      let query = supabase
        .from('marina_prospects')
        .select('*, prospect_outreach_queue(*)')
        .order('score', { ascending: false })
        .limit(limit);

      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) return jsonError(error.message, 500);
      return jsonOk({ success: true, prospects: data || [] });
    }

    // ─── Update status ───
    if (action === 'update_status') {
      const { prospect_id, status, outreach_id } = body;
      if (!prospect_id && !outreach_id) return jsonError('prospect_id or outreach_id required');

      if (prospect_id) {
        await supabase.from('marina_prospects').update({ status }).eq('id', prospect_id);
      }
      if (outreach_id) {
        const updates: any = { status };
        if (status === 'sent') updates.sent_at = new Date().toISOString();
        if (status === 'replied') updates.replied_at = new Date().toISOString();
        await supabase.from('prospect_outreach_queue').update(updates).eq('id', outreach_id);
      }

      return jsonOk({ success: true });
    }

    // ─── Advance Sequence: move prospects to next step if delay elapsed ───
    if (action === 'advance_sequence') {
      const now = new Date();
      // Get all active queue items where next_action_at has passed
      const { data: dueItems } = await supabase
        .from('prospect_outreach_queue')
        .select('*, marina_prospects!prospect_outreach_queue_prospect_id_fkey(*)')
        .in('status', ['sent', 'ready'])
        .lte('next_action_at', now.toISOString())
        .not('next_action_at', 'is', null)
        .limit(50);

      if (!dueItems || dueItems.length === 0) {
        return jsonOk({ success: true, advanced: 0, message: 'No items due for advancement' });
      }

      let advancedCount = 0;
      for (const item of dueItems as any[]) {
        const prospect = item.marina_prospects;
        if (!prospect) continue;

        // Get the sequence to find next step
        let steps: any[] = [];
        if (item.sequence_id) {
          const { data: seq } = await supabase
            .from('outreach_sequences')
            .select('steps')
            .eq('id', item.sequence_id)
            .maybeSingle();
          if (seq?.steps) steps = seq.steps as any[];
        }
        
        if (steps.length === 0) {
          // Use default sequence
          steps = [
            { step: 1, channel: 'linkedin', action: 'invitation', delay_days: 0 },
            { step: 2, channel: 'linkedin', action: 'message', delay_days: 2 },
            { step: 3, channel: 'email', action: 'email_pitch', delay_days: 5 },
            { step: 4, channel: 'email', action: 'email_followup', delay_days: 10 },
          ];
        }

        const currentStep = item.step_number || 1;
        const nextStepDef = steps.find((s: any) => s.step === currentStep + 1);
        
        if (!nextStepDef) {
          // Sequence complete — mark as done
          await supabase
            .from('prospect_outreach_queue')
            .update({ status: 'sequence_complete', next_action_at: null })
            .eq('id', item.id);
          
          // Log event
          await supabase.from('outreach_events').insert({
            prospect_id: prospect.id,
            queue_item_id: item.id,
            user_id: prospect.user_id || '00000000-0000-0000-0000-000000000000',
            event_type: 'sequence_completed',
            channel: item.channel || 'linkedin',
          });
          advancedCount++;
          continue;
        }

        // Generate message for next step
        const isEmailStep = nextStepDef.channel === 'email';
        let messageContent = '';
        
        if (isEmailStep) {
          // Email step — generate email pitch
          messageContent = await generateMessage(
            prospect, 
            prospect.marina_report_url ? 'audit_ready' : 'ask_url',
            prospect.marina_report_url
          );
        } else {
          // LinkedIn step — generate LinkedIn message  
          messageContent = await generateMessage(
            prospect,
            prospect.marina_report_url ? 'audit_ready' : 'ask_url',
            prospect.marina_report_url
          );
        }

        // Calculate next action time with random jitter (±2h to look human)
        const nextDelay = steps.find((s: any) => s.step === currentStep + 2);
        let nextActionAt: string | null = null;
        if (nextDelay) {
          const jitterHours = (Math.random() - 0.5) * 4; // ±2h
          const delayMs = (nextDelay.delay_days - nextStepDef.delay_days) * 86400000 + jitterHours * 3600000;
          nextActionAt = new Date(Date.now() + delayMs).toISOString();
        }

        // Create new queue item for next step
        await supabase.from('prospect_outreach_queue').insert({
          prospect_id: prospect.id,
          step_number: nextStepDef.step,
          channel: nextStepDef.channel,
          sequence_id: item.sequence_id,
          message_type: nextStepDef.action,
          message_content: messageContent,
          message_language: prospect.language || 'fr',
          report_share_url: prospect.marina_report_url || null,
          email_address: item.email_address,
          status: isEmailStep ? 'ready_email' : 'ready',
          next_action_at: nextActionAt,
        });

        // Mark old item as advanced
        await supabase
          .from('prospect_outreach_queue')
          .update({ status: 'advanced', next_action_at: null })
          .eq('id', item.id);

        // Log event
        await supabase.from('outreach_events').insert({
          prospect_id: prospect.id,
          queue_item_id: item.id,
          user_id: prospect.user_id || '00000000-0000-0000-0000-000000000000',
          event_type: 'step_advanced',
          channel: nextStepDef.channel,
          metadata: { from_step: currentStep, to_step: nextStepDef.step, action: nextStepDef.action },
        });

        advancedCount++;
      }

      return jsonOk({ success: true, advanced: advancedCount });
    }

    // ─── Get/Update daily quotas ───
    if (action === 'get_quotas') {
      const userId = body.user_id;
      if (!userId) return jsonError('user_id required');
      
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('outreach_daily_quotas')
        .select('*')
        .eq('user_id', userId)
        .eq('quota_date', today)
        .maybeSingle();
      
      return jsonOk({ 
        success: true, 
        quotas: data || { invitations_sent: 0, messages_sent: 0, max_invitations: 20, max_messages: 40, quota_date: today } 
      });
    }

    if (action === 'increment_quota') {
      const userId = body.user_id;
      const quotaType = body.type; // 'invitation' or 'message'
      if (!userId || !quotaType) return jsonError('user_id and type required');

      const today = new Date().toISOString().split('T')[0];
      
      // Upsert today's quota
      const { data: existing } = await supabase
        .from('outreach_daily_quotas')
        .select('*')
        .eq('user_id', userId)
        .eq('quota_date', today)
        .maybeSingle();

      if (existing) {
        const field = quotaType === 'invitation' ? 'invitations_sent' : 'messages_sent';
        const maxField = quotaType === 'invitation' ? 'max_invitations' : 'max_messages';
        const current = (existing as any)[field] || 0;
        const max = (existing as any)[maxField] || (quotaType === 'invitation' ? 20 : 40);
        
        if (current >= max) {
          return jsonOk({ success: false, quota_exceeded: true, current, max });
        }

        await supabase
          .from('outreach_daily_quotas')
          .update({ [field]: current + 1 })
          .eq('id', existing.id);
        
        return jsonOk({ success: true, current: current + 1, max, remaining: max - current - 1 });
      } else {
        const field = quotaType === 'invitation' ? 'invitations_sent' : 'messages_sent';
        await supabase.from('outreach_daily_quotas').insert({
          user_id: userId,
          quota_date: today,
          [field]: 1,
        });
        return jsonOk({ success: true, current: 1, max: quotaType === 'invitation' ? 20 : 40 });
      }
    }

    // ─── Run full nightly pipeline ───
    if (action === 'nightly_run') {
      // Step 1: Qualify new prospects
      const qualifyResp = await fetch(`${SUPABASE_URL}/functions/v1/prospect-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ action: 'qualify_batch' }),
      });
      const qualifyResult = await qualifyResp.json();

      // Step 2: Prepare outreach for qualified
      const prepareResp = await fetch(`${SUPABASE_URL}/functions/v1/prospect-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ action: 'prepare_outreach', limit: 15 }),
      });
      const prepareResult = await prepareResp.json();

      // Step 3: Finalize pending (check Marina results)
      const finalizeResp = await fetch(`${SUPABASE_URL}/functions/v1/prospect-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ action: 'finalize_pending' }),
      });
      const finalizeResult = await finalizeResp.json();

      // Step 4: Advance sequences (move to next step if delay elapsed)
      const advanceResp = await fetch(`${SUPABASE_URL}/functions/v1/prospect-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ action: 'advance_sequence' }),
      });
      const advanceResult = await advanceResp.json();

      return jsonOk({
        success: true,
        nightly_run: {
          qualified: qualifyResult.qualified || 0,
          prepared: prepareResult.prepared || 0,
          finalized: finalizeResult.finalized || 0,
          advanced: advanceResult.advanced || 0,
        },
      });
    }

    return jsonError('Unknown action. Use: webhook_import, qualify_batch, prepare_outreach, finalize_pending, advance_sequence, get_quotas, increment_quota, list, update_status, nightly_run');
  } catch (e: any) {
    console.error('prospect-pipeline error:', e);
    return jsonError(e.message || 'Internal error', 500);
  }
}, 'prospect-pipeline'))
