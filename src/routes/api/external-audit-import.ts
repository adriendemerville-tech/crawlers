/**
 * POST /api/external-audit-import
 *
 * Importe un audit tiers déposé dans le chat (PDF, DOCX, TXT/MD/CSV/JSON/HTML),
 * en extrait le texte et le stocke dans `external_audits` pour que la skill
 * `confront_external_audit` (Félix / Stratège) puisse le confronter aux données
 * Crawlers.
 *
 * Rationalisation tokens : extraction déterministe (0 LLM) pour tous les formats
 * texte et DOCX. Un seul appel LLM de transcription pour les PDF, sur le modèle
 * le moins cher.
 */
import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { unzipSync, strFromU8 } from 'fflate';

const MAX_CHARS = 120_000;

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',')[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function stripXmlToText(xml: string): string {
  return xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x?[0-9a-fA-F]+;/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function transcribePdf(filename: string, base64: string, apiKey: string): Promise<string> {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': apiKey },
    body: JSON.stringify({
      model: 'google/gemini-3.1-flash-lite',
      temperature: 0,
      max_tokens: 8000,
      messages: [
        {
          role: 'system',
          content:
            "Tu es un extracteur de texte. Restitue le contenu du document TEL QUEL : aucun résumé, aucun commentaire, aucune reformulation. Conserve les titres, les chiffres, les tableaux (markdown) et les URLs.",
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Restitue intégralement le texte de ce document (${filename}).` },
            { type: 'file', file: { filename, file_data: `data:application/pdf;base64,${clean}` } },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`transcription PDF refusée (${resp.status}) ${detail.slice(0, 180)}`);
  }
  const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim().length < 20) {
    throw new Error('transcription PDF vide — document illisible ou protégé');
  }
  return text.trim();
}

export const Route = createFileRoute('/api/external-audit-import')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get('Authorization') ?? '';
        if (!authHeader.startsWith('Bearer ')) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseUrl = process.env['SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'];
        const publishableKey =
          process.env['SUPABASE_PUBLISHABLE_KEY'] ??
          process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ??
          process.env['SUPABASE_ANON_KEY'];
        if (!supabaseUrl || !publishableKey) {
          return Response.json({ error: 'Backend non configuré' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, publishableKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !userData?.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = userData.user.id;

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const filename = String(body.filename ?? 'audit').slice(0, 200);
        const mime = String(body.mime ?? '').toLowerCase();
        const base64 = typeof body.base64 === 'string' ? body.base64 : null;
        const plainText = typeof body.text === 'string' ? body.text : null;
        const domain = body.domain
          ? String(body.domain)
              .replace(/^https?:\/\//, '')
              .replace(/^www\./, '')
              .replace(/\/.*$/, '')
              .toLowerCase()
          : null;
        const trackedSiteId = typeof body.tracked_site_id === 'string' ? body.tracked_site_id : null;
        const sourceLabel = body.source_label ? String(body.source_label).slice(0, 120) : null;

        if (!base64 && !plainText) {
          return Response.json({ error: 'base64 ou text requis' }, { status: 400 });
        }

        const lower = filename.toLowerCase();
        let text = '';
        let extraction = 'text';

        try {
          if (plainText) {
            text = plainText;
          } else if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
            const apiKey = process.env['LOVABLE_API_KEY'];
            if (!apiKey) throw new Error('clé IA indisponible pour la transcription PDF');
            text = await transcribePdf(filename, base64!, apiKey);
            extraction = 'pdf_llm';
          } else if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) {
            const files = unzipSync(base64ToBytes(base64!));
            const doc = files['word/document.xml'];
            if (!doc) throw new Error('DOCX invalide (word/document.xml absent)');
            text = stripXmlToText(strFromU8(doc));
            extraction = 'docx';
          } else if (lower.endsWith('.doc')) {
            return Response.json(
              { error: 'Format .doc non pris en charge : convertis en .docx ou en PDF.' },
              { status: 415 },
            );
          } else {
            const raw = strFromU8(base64ToBytes(base64!));
            text = /\.html?$/i.test(lower) || mime.includes('html') ? stripHtmlToText(raw) : raw;
          }
        } catch (e) {
          return Response.json(
            { error: `Extraction impossible : ${(e as Error).message}` },
            { status: 422 },
          );
        }

        text = text.replace(/\u0000/g, '').trim();
        if (text.length < 40) {
          return Response.json(
            { error: "Le fichier ne contient pas assez de texte exploitable." },
            { status: 422 },
          );
        }

        const truncated = text.length > MAX_CHARS;
        if (truncated) text = `${text.slice(0, MAX_CHARS)}\n\n[... tronqué à ${MAX_CHARS} caractères ...]`;

        const { data, error } = await supabase
          .from('external_audits')
          .insert({
            user_id: userId,
            tracked_site_id: trackedSiteId,
            domain,
            source_label: sourceLabel,
            filename,
            mime_type: mime || null,
            raw_text: text,
            char_count: text.length,
          })
          .select('id, char_count')
          .single();

        if (error) {
          return Response.json({ error: `Enregistrement impossible : ${error.message}` }, { status: 500 });
        }

        return Response.json({
          external_audit_id: data.id,
          char_count: data.char_count,
          extraction,
          truncated,
          preview: text.slice(0, 400),
        });
      },
    },
  },
});
