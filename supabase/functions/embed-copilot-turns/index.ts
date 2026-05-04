/**
 * embed-copilot-turns — worker qui calcule l'embedding des messages utilisateur
 * du copilote (skill = '_user_message') qui n'en ont pas encore.
 *
 * À appeler en cron (toutes les 5 minutes recommandé) ou manuellement.
 *
 * RÈGLE CRITIQUE (cf. note d'architecture §4.1) :
 *   On embed UNIQUEMENT les messages utilisateur, JAMAIS les réponses
 *   assistant — sinon auto-renforcement (le contexte injecté contient ses
 *   propres anciennes réponses qu'il re-cite, divergence garantie).
 *
 * Sécurité : utilise le service role pour bypasser RLS — strictement scoped
 * aux lignes skill='_user_message' AND embedding IS NULL.
 */
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';
import { embedText, toPgVector } from '../_shared/embeddings.ts';

const BATCH_SIZE = 50;
const MAX_PARALLEL = 5;

interface PendingRow {
  id: string;
  input: { message?: string; text?: string } | null;
}

async function processBatch(): Promise<{ embedded: number; failed: number; skipped: number }> {
  const supabase = getServiceClient();

  // 1. Sélectionne les messages user sans embedding (index partiel idx_copilot_actions_embedding_pending)
  const { data, error } = await supabase
    .from('copilot_actions')
    .select('id, input')
    .eq('skill', '_user_message')
    .is('embedding', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(`select failed: ${error.message}`);
  const rows = (data as PendingRow[]) ?? [];
  if (rows.length === 0) return { embedded: 0, failed: 0, skipped: 0 };

  let embedded = 0, failed = 0, skipped = 0;

  // 2. Process avec parallélisme contrôlé
  let idx = 0;
  async function worker() {
    while (idx < rows.length) {
      const row = rows[idx++];
      if (!row) break;
      const text = row.input?.message ?? row.input?.text ?? '';
      if (!text || text.length < 3) {
        // Marque comme "embedded vide" pour ne pas re-traiter en boucle :
        // on insère un vecteur de zéros (faible cosine vs tout, hors résultats).
        const zero = new Array(768).fill(0);
        await supabase.from('copilot_actions')
          .update({ embedding: toPgVector(zero) })
          .eq('id', row.id);
        skipped++;
        continue;
      }
      const result = await embedText(text);
      if (!result) { failed++; continue; }
      const { error: upErr } = await supabase
        .from('copilot_actions')
        .update({ embedding: toPgVector(result.embedding) })
        .eq('id', row.id);
      if (upErr) { failed++; console.warn('[embed-copilot-turns] update failed:', upErr.message); }
      else embedded++;
    }
  }

  await Promise.allSettled(
    Array.from({ length: Math.min(MAX_PARALLEL, rows.length) }, () => worker()),
  );

  return { embedded, failed, skipped };
}

Deno.serve(handleRequest(async () => {
  try {
    const result = await processBatch();
    return jsonOk(result);
  } catch (e) {
    console.error('[embed-copilot-turns] error:', e);
    return jsonError((e as Error).message, 500);
  }
}));
