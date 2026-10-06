/**
 * Facturation des rapports Marina lancés via le serveur MCP.
 *
 * Réutilise les RPC existants (aucune logique SQL dupliquée) :
 *  - `use_credit(p_user_id, p_description, p_amount)` : débit atomique (FOR UPDATE),
 *    journalisé dans credit_transactions, neutralisé pour les admins.
 *    Garde interne `IF auth.uid() != p_user_id` : appelé avec le client service,
 *    auth.uid() vaut NULL, la comparaison est NULL et la garde ne bloque pas.
 *    C'est la variante serveur déjà utilisée par d'autres fonctions (crawl-site…).
 *  - `atomic_credit_update(p_user_id, p_amount)` : ajoute p_amount au solde ;
 *    montant POSITIF = remboursement (même convention que src/pages/Marina.tsx).
 *
 * Aujourd'hui `marina/index.ts` ne débite RIEN côté serveur (le débit de l'UI est
 * fait par Marina.tsx). Si un débit est un jour ajouté au chemin clé de marina,
 * le MCP doit cesser de débiter ici, sinon double facturation.
 */
import { getServiceClient } from './supabaseClient.ts';

export const MARINA_MCP_REPORT_COST = 5;

export type MarinaEntitlement = 'admin' | 'subscription' | 'credits';

export function checkMarinaEntitlement(caller: { isAdmin: boolean; isProAgency: boolean }): MarinaEntitlement {
  if (caller.isAdmin) return 'admin';
  if (caller.isProAgency) return 'subscription';
  return 'credits';
}

export async function chargeMarinaReport(
  userId: string,
  url: string,
): Promise<{ success: true; balance: number } | { success: false; balance: number; error: string }> {
  const sb = getServiceClient();
  const { data, error } = await sb.rpc('use_credit', {
    p_user_id: userId,
    p_description: `Rapport Marina (MCP) — ${url}`.slice(0, 500),
    p_amount: MARINA_MCP_REPORT_COST,
  });
  if (error) return { success: false, balance: await currentBalance(userId), error: error.message };
  const r = (data ?? {}) as { success?: boolean; new_balance?: number; balance?: number; error?: string };
  if (r.success) return { success: true, balance: Number(r.new_balance ?? 0) };
  return {
    success: false,
    balance: Number(r.balance ?? (await currentBalance(userId))),
    error: r.error || 'Insufficient credits',
  };
}

export async function refundMarinaReport(userId: string, amount: number = MARINA_MCP_REPORT_COST): Promise<void> {
  try {
    await getServiceClient().rpc('atomic_credit_update', { p_user_id: userId, p_amount: Math.abs(amount) });
  } catch (e) {
    console.error('[marinaBilling] refund failed', userId, (e as Error).message);
  }
}

async function currentBalance(userId: string): Promise<number> {
  const { data } = await getServiceClient().from('profiles').select('credits_balance').eq('user_id', userId).maybeSingle();
  return Number((data as any)?.credits_balance ?? 0);
}
