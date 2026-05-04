/**
 * embeddings.ts — Helper d'embedding via Lovable AI Gateway.
 *
 * Utilise google/text-embedding-004 (768 dimensions) — compatible avec la
 * colonne `vector(768)` de copilot_actions et les tables similaires.
 *
 * En cas d'erreur du gateway, retourne null (l'appelant décide quoi faire).
 */

const EMBEDDING_MODEL = 'google/text-embedding-004';
const EMBEDDING_DIM = 768;
const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/embeddings';

export interface EmbedResult {
  embedding: number[];
  model: string;
  dim: number;
}

/**
 * Génère l'embedding d'un texte unique. Tronque à 8000 caractères pour rester
 * sous la limite tokens du modèle.
 */
export async function embedText(text: string): Promise<EmbedResult | null> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    console.warn('[embeddings] LOVABLE_API_KEY manquant');
    return null;
  }
  const cleaned = text.trim().slice(0, 8000);
  if (!cleaned) return null;

  try {
    const resp = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: cleaned }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.warn(`[embeddings] gateway ${resp.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const json = await resp.json();
    const embedding = json?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
      console.warn(`[embeddings] dimension inattendue: ${embedding?.length}`);
      return null;
    }
    return { embedding, model: EMBEDDING_MODEL, dim: EMBEDDING_DIM };
  } catch (e) {
    console.warn('[embeddings] erreur fetch:', (e as Error).message);
    return null;
  }
}

/**
 * Sérialise un vecteur au format pgvector (`[0.1,0.2,...]`).
 */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
