/**
 * Regroupe les jobs d'un même audit multipages en une seule entrée.
 * - Priorité au marqueur `batchId` posé au lancement.
 * - Repli pour les lots antérieurs : jobs consécutifs du même domaine, lancés
 *   à moins de 5 minutes d'intervalle et portant des URLs distinctes.
 */
export interface MarinaAuditLike {
  id: string;
  domain?: string | null;
  url?: string | null;
  createdAt: string;
  batchId?: string | null;
  hasReport?: boolean;
  status?: string | null;
  globalScore?: number | null;
}

export interface MarinaAuditGroup<T extends MarinaAuditLike> {
  key: string;
  main: T;
  items: T[];
}

export function groupAudits<T extends MarinaAuditLike>(audits: T[]): MarinaAuditGroup<T>[] {
  const groups: MarinaAuditGroup<T>[] = [];
  const byBatch = new Map<string, MarinaAuditGroup<T>>();

  for (const a of audits) {
    if (a.batchId) {
      const existing = byBatch.get(a.batchId);
      if (existing) { existing.items.push(a); continue; }
      const g: MarinaAuditGroup<T> = { key: a.batchId, main: a, items: [a] };
      byBatch.set(a.batchId, g);
      groups.push(g);
      continue;
    }

    const last = groups[groups.length - 1];
    const lastItem = last?.items[last.items.length - 1];
    const sameDomain = lastItem && !lastItem.batchId && lastItem.domain === a.domain;
    const closeInTime =
      lastItem && Math.abs(new Date(lastItem.createdAt).getTime() - new Date(a.createdAt).getTime()) < 5 * 60_000;
    const distinctUrl = lastItem && last!.items.every(i => (i.url || '') !== (a.url || ''));

    if (sameDomain && closeInTime && distinctUrl) last!.items.push(a);
    else groups.push({ key: a.id, main: a, items: [a] });
  }

  return groups;
}
