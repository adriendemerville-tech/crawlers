import { supabase } from '@/integrations/supabase/client';

export interface ExternalAuditImportResult {
  external_audit_id: string;
  char_count: number;
  extraction: string;
  truncated: boolean;
  preview: string;
}

const TEXT_EXT = /\.(txt|md|markdown|csv|json|xml|html?|log)$/i;
const DOC_EXT = /\.(pdf|docx|doc)$/i;

export function isAuditImportable(file: File): boolean {
  return TEXT_EXT.test(file.name) || DOC_EXT.test(file.name);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}

/**
 * Envoie un audit tiers (PDF / DOCX / texte) à /api/external-audit-import,
 * qui extrait le texte et le stocke dans `external_audits`.
 */
export async function importExternalAudit(
  file: File,
  opts?: { domain?: string; trackedSiteId?: string },
): Promise<ExternalAuditImportResult> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Fichier trop lourd (15 Mo maximum).');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Session expirée — reconnecte-toi pour importer un audit.');

  const base64 = await fileToBase64(file);

  const resp = await fetch('/api/external-audit-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      filename: file.name,
      mime: file.type,
      base64,
      domain: opts?.domain ?? null,
      tracked_site_id: opts?.trackedSiteId ?? null,
    }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((json as { error?: string }).error ?? `Import impossible (${resp.status})`);
  return json as ExternalAuditImportResult;
}

/** Message utilisateur qui déclenche la confrontation par Félix / le Stratège. */
export function buildConfrontationPrompt(
  result: ExternalAuditImportResult,
  filename: string,
  domain?: string,
): string {
  return [
    `J'ai importé un audit tiers : « ${filename} » (external_audit_id : ${result.external_audit_id}${domain ? `, domaine : ${domain}` : ''}).`,
    'Confronte-le à nos données Crawlers avec confront_external_audit :',
    "pour chaque affirmation, donne le verdict (FIABLE / NON FIABLE / CONFIRMÉ PAR CRAWLERS / CONTRADICTOIRE), notre donnée, et un commentaire court.",
    "Si une donnée nous manque ou si tu n'es pas d'accord, propose l'action de vérification correspondante et attends mon accord.",
  ].join(' ');
}
