/**
 * scoring.ts — Sprint Q5 Bloc 3
 *
 * Calcule et upsert un sav_quality_scores après chaque tour assistant_reply
 * d'une session copilot. Réutilise la table sav_quality_scores legacy pour
 * que le SAV Dashboard admin continue de fonctionner sans changement.
 *
 * - precision_score : 0-100, heuristique légère portée du legacy sav-agent.
 * - escalated_to_phone : déduit de la présence d'une action escalate_to_phone success.
 * - detected_intent / intent_keywords : extraits du dernier message user.
 * - suggested_route : extrait de la dernière réponse assistant si elle propose un lien interne.
 *
 * Toutes les écritures passent par le service client (RLS bypass volontaire,
 * mais ownership vérifiée par session_id + user_id en lecture).
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const STOP_WORDS = new Set([
  'avec', 'pour', 'dans', 'sans', 'mais', 'donc', 'parce', 'plus', 'moins',
  'cette', 'cette', 'celui', 'celle', 'leur', 'leurs', 'mon', 'ton', 'son',
  'mes', 'tes', 'ses', 'notre', 'votre', 'nous', 'vous', 'elle', 'ils',
  'que', 'qui', 'quoi', 'comment', 'pourquoi', 'quand', 'tout', 'tous', 'toute', 'toutes',
  'this', 'that', 'with', 'from', 'have', 'will', 'your', 'their',
]);

function extractKeywords(text: string, max = 10): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
    .slice(0, max);
}

function detectIntent(text: string): string {
  const lower = text.toLowerCase();
  if (/où|comment accéder|trouver|cherche|onglet|bouton|menu|page/.test(lower)) return 'navigation';
  if (/score|geo|seo|llm|citation|sentiment/.test(lower)) return 'score';
  if (/crédit|abonnement|prix|tarif|payer|facturer/.test(lower)) return 'billing';
  if (/bug|erreur|marche pas|bloqué|problème|plante/.test(lower)) return 'bug';
  if (/crawl|scan|audit|analyse/.test(lower)) return 'feature';
  if (/cms|wordpress|shopify|wix|webflow|connecter|déployer/.test(lower)) return 'cms';
  return 'general';
}

function extractSuggestedRoute(reply: string): string | null {
  // 1) URLs absolues crawlers.fr
  const abs = reply.match(/https:\/\/(?:www\.)?crawlers\.fr(\/[a-z0-9\-/]*)/i);
  if (abs) return abs[1];
  // 2) Liens markdown internes [label](/path) — première occurrence
  const md = reply.match(/\]\((\/[a-z0-9\-/]+)\)/i);
  if (md) return md[1];
  return null;
}

interface ScoringInput {
  service: SupabaseClient;
  sessionId: string;
  userId: string;
  persona: string;
  lastUserMessage: string;
  assistantReply: string;
  /** Actions exécutées dans ce tour (pour détecter escalate_to_phone success). */
  executedActions: Array<{ skill: string; status: string }>;
}

export async function recordTurnQualityScore(input: ScoringInput): Promise<void> {
  const { service, sessionId, userId, persona, lastUserMessage, assistantReply, executedActions } = input;

  try {
    // 1) Récupérer la sav_conversation "shadow" liée (créée par escalate_to_phone)
    //    ou la créer à la volée pour stocker les scores.
    const { data: sess } = await service
      .from('copilot_sessions')
      .select('context')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    const sessionCtx = (sess?.context as Record<string, unknown> | null) ?? {};
    let savConvId = sessionCtx.sav_conversation_id as string | undefined;

    if (!savConvId) {
      const { data: prof } = await service
        .from('profiles')
        .select('email')
        .eq('user_id', userId)
        .maybeSingle();
      const { data: created, error: cErr } = await service
        .from('sav_conversations')
        .insert({
          user_id: userId,
          user_email: prof?.email ?? null,
          messages: [],
          message_count: 0,
          assistant_type: persona,
          escalated: false,
          metadata: { copilot_session_id: sessionId, source: 'copilot' },
        })
        .select('id')
        .single();
      if (cErr || !created) {
        console.warn('[copilot scoring] cannot create shadow sav_conversation:', cErr?.message);
        return;
      }
      savConvId = created.id;
      await service
        .from('copilot_sessions')
        .update({ context: { ...sessionCtx, sav_conversation_id: savConvId } })
        .eq('id', sessionId);
    }

    // 2) Compter les tours user de la session (depuis copilot_actions skill='_user_message')
    const { count: userMsgCountRaw } = await service
      .from('copilot_actions')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('skill', '_user_message');
    const userMsgCount = Math.max(1, userMsgCountRaw ?? 1);

    // 3) Détecter intention répétée : on regarde les 5 derniers user messages
    const { data: prevUserMsgs } = await service
      .from('copilot_actions')
      .select('input, created_at')
      .eq('session_id', sessionId)
      .eq('skill', '_user_message')
      .order('created_at', { ascending: false })
      .limit(5);

    const intentKeywords = extractKeywords(lastUserMessage);
    let repeatedIntentCount = 0;
    if (prevUserMsgs && prevUserMsgs.length >= 2) {
      const prevText = prevUserMsgs
        .slice(1) // skip current
        .map((r) => {
          const inp = r.input as Record<string, unknown> | null;
          return typeof inp?.content === 'string' ? inp.content : '';
        })
        .join(' ');
      const prevSet = new Set(extractKeywords(prevText, 50));
      const overlap = intentKeywords.filter((kw) => prevSet.has(kw));
      if (overlap.length >= 3) repeatedIntentCount = prevUserMsgs.length - 1;
    }

    // 4) Escalade téléphone : détectée si une action escalate_to_phone success existe sur la session
    const escalatedNow = executedActions.some(
      (a) => a.skill === 'escalate_to_phone' && a.status === 'success',
    );
    let escalatedToPhone = escalatedNow;
    if (!escalatedToPhone) {
      const { count: escCount } = await service
        .from('copilot_actions')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .eq('skill', 'escalate_to_phone')
        .eq('status', 'success');
      escalatedToPhone = (escCount ?? 0) > 0;
    }

    // 5) Score (heuristique portée du legacy sav-agent)
    let precisionScore = 50;
    if (userMsgCount <= 2) precisionScore += 20;
    precisionScore -= repeatedIntentCount * 20;
    if (escalatedToPhone) precisionScore -= 50;
    precisionScore = Math.max(0, Math.min(100, precisionScore));

    const detectedIntent = detectIntent(lastUserMessage);
    const suggestedRoute = extractSuggestedRoute(assistantReply);

    // 6) Upsert (1 ligne par sav_conversation)
    const { data: existing } = await service
      .from('sav_quality_scores')
      .select('id')
      .eq('conversation_id', savConvId)
      .maybeSingle();

    const payload = {
      message_count: userMsgCount,
      repeated_intent_count: repeatedIntentCount,
      escalated_to_phone: escalatedToPhone,
      precision_score: precisionScore,
      detected_intent: detectedIntent,
      intent_keywords: intentKeywords,
      suggested_route: suggestedRoute,
    };

    if (existing) {
      await service.from('sav_quality_scores').update(payload).eq('id', existing.id);
    } else {
      await service.from('sav_quality_scores').insert({
        conversation_id: savConvId,
        user_id: userId,
        ...payload,
      });
    }
  } catch (e) {
    // Best-effort : un échec scoring ne doit jamais casser la conversation
    console.warn('[copilot scoring] error:', (e as Error).message);
  }
}
