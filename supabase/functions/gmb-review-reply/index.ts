/**
 * gmb-review-reply — Generate automated, contextual replies to Google reviews using Lovable AI.
 *
 * Actions:
 *   - generate-reply: Generate a draft reply for a single review
 *   - generate-batch: Generate draft replies for multiple reviews
 */
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

interface ReviewInput {
  reviewer_name: string;
  rating: number;         // 1-5
  review_text: string;
  review_date?: string;
}

interface ReplyOptions {
  business_name: string;
  business_category?: string;
  tone?: 'professional' | 'friendly' | 'warm' | 'formal';
  language?: 'fr' | 'en' | 'es';
  max_length?: number;
  include_cta?: boolean;
  owner_name?: string;
}

function buildSystemPrompt(options: ReplyOptions): string {
  const lang = options.language || 'fr';
  const tone = options.tone || 'professional';
  const langLabel = lang === 'fr' ? 'français' : lang === 'es' ? 'español' : 'English';
  const maxLen = options.max_length || 300;

  return `Tu es un expert en gestion de réputation en ligne et en réponses aux avis Google.
Tu rédiges des réponses ${tone === 'professional' ? 'professionnelles' : tone === 'friendly' ? 'chaleureuses et amicales' : tone === 'warm' ? 'bienveillantes' : 'formelles'} aux avis Google pour l'établissement "${options.business_name}"${options.business_category ? ` (${options.business_category})` : ''}.

Règles strictes :
- Réponds en ${langLabel}.
- Maximum ${maxLen} caractères.
- Remercie toujours le client par son prénom.
- Pour les avis positifs (4-5 étoiles) : remercie chaleureusement, mentionne un élément spécifique de l'avis, invite à revenir.
- Pour les avis mitigés (3 étoiles) : remercie, reconnaît les points positifs, propose d'améliorer les points négatifs.
- Pour les avis négatifs (1-2 étoiles) : présente des excuses sincères, ne sois pas défensif, propose une solution concrète, invite à recontacter en privé.
- Ne répète jamais la même formule d'ouverture.
- Ne mentionne JAMAIS de réduction/cadeau/compensation dans la réponse publique.
- ${options.include_cta ? 'Termine par un appel à l\'action subtil (revenir, nous recommander, nous contacter).' : 'Pas d\'appel à l\'action commercial.'}
${options.owner_name ? `- Signe avec le prénom "${options.owner_name}".` : '- Ne signe pas la réponse.'}

Retourne UNIQUEMENT le texte de la réponse, sans guillemets ni formatage.`;
}

function buildUserPrompt(review: ReviewInput): string {
  const stars = '⭐'.repeat(review.rating);
  return `Avis de ${review.reviewer_name} (${stars} ${review.rating}/5)${review.review_date ? ` du ${review.review_date}` : ''} :
"${review.review_text}"

Rédige la réponse appropriée.`;
}

async function generateReply(
  review: ReviewInput,
  options: ReplyOptions,
  apiKey: string,
): Promise<{ reply: string; sentiment: string; priority: string }> {
  const sentiment = review.rating >= 4 ? 'positive' : review.rating === 3 ? 'neutral' : 'negative';
  const priority = review.rating <= 2 ? 'high' : review.rating === 3 ? 'medium' : 'low';

  const response = await fetch(AI_GATEWAY, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system', content: buildSystemPrompt(options) },
        { role: 'user', content: buildUserPrompt(review) },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw Object.assign(new Error('Rate limit exceeded'), { status: 429 });
    if (status === 402) throw Object.assign(new Error('Payment required — add credits'), { status: 402 });
    const body = await response.text();
    throw new Error(`AI gateway error [${status}]: ${body}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim() || '';

  return { reply, sentiment, priority };
}

Deno.serve(handleRequest(async (req) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return jsonError('Unauthorized', 401);

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return jsonError('LOVABLE_API_KEY not configured', 500);

  const body = await req.json();
  const { action, review, reviews, options, tracked_site_id } = body as {
    action: string;
    review?: ReviewInput;
    reviews?: ReviewInput[];
    options: ReplyOptions;
    tracked_site_id?: string;
  };

  if (!action || !options?.business_name) {
    return jsonError('action and options.business_name required');
  }

  const sb = getServiceClient();

  switch (action) {
    case 'generate-reply': {
      if (!review || !review.review_text) return jsonError('review object with review_text required');

      const result = await generateReply(review, options, LOVABLE_API_KEY);

      // Log usage
      await sb.from('analytics_events').insert({
        user_id: auth.userId,
        event_type: 'gmb-review-reply:single',
        event_data: { tracked_site_id, rating: review.rating, sentiment: result.sentiment },
      }).catch(() => {});

      return jsonOk({
        reply: result.reply,
        sentiment: result.sentiment,
        priority: result.priority,
        reviewer_name: review.reviewer_name,
        rating: review.rating,
      });
    }

    case 'generate-batch': {
      if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
        return jsonError('reviews array required');
      }
      if (reviews.length > 20) return jsonError('Maximum 20 reviews per batch');

      const results = await Promise.allSettled(
        reviews.map(r => generateReply(r, options, LOVABLE_API_KEY))
      );

      const replies = results.map((r, i) => ({
        reviewer_name: reviews[i].reviewer_name,
        rating: reviews[i].rating,
        ...(r.status === 'fulfilled'
          ? { reply: r.value.reply, sentiment: r.value.sentiment, priority: r.value.priority }
          : { reply: null, error: r.reason?.message || 'Generation failed', sentiment: 'unknown', priority: 'unknown' }
        ),
      }));

      // Log batch usage
      await sb.from('analytics_events').insert({
        user_id: auth.userId,
        event_type: 'gmb-review-reply:batch',
        event_data: { tracked_site_id, count: reviews.length, success: replies.filter(r => r.reply).length },
      }).catch(() => {});

      return jsonOk({
        replies,
        total: reviews.length,
        generated: replies.filter(r => r.reply).length,
      });
    }

    default:
      return jsonError(`Unknown action: ${action}`);
  }
}, 'gmb-review-reply'));
