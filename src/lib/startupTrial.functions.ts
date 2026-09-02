import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const siretSchema = z.string().transform((value) => value.replace(/\s/g, '')).pipe(z.string().regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres.'));

export const verifyStartupSiret = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ siret: siretSchema }).parse(data))
  .handler(async ({ data }) => {
    const response = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${data.siret}&per_page=1`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return { eligible: false, reason: 'L’annuaire officiel est temporairement indisponible.' };

    const payload = await response.json() as {
      results?: Array<{
        nom_complet?: string;
        siege?: { siret?: string };
        date_creation?: string;
        etat_administratif?: string;
      }>;
    };
    const company = payload.results?.find((entry) => entry.siege?.siret === data.siret) ?? payload.results?.[0];
    if (!company?.date_creation) return { eligible: false, reason: 'SIRET introuvable dans l’annuaire officiel.' };
    const creationDate = company.date_creation.slice(0, 10);
    const creation = new Date(`${creationDate}T00:00:00Z`);
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setUTCFullYear(twelveMonthsAgo.getUTCFullYear() - 1);
    const eligible = company.etat_administratif !== 'C' && creation >= twelveMonthsAgo && creation <= now;

    return {
      eligible,
      siret: data.siret,
      legalName: company.nom_complet ?? 'Entreprise vérifiée',
      creationDate,
      reason: eligible ? null : 'Cette entreprise a plus de 12 mois ou n’est plus active.',
    };
  });

export const submitStartupTrial = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    siret: siretSchema,
    legalName: z.string().trim().min(2).max(200),
    creationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kbisPath: z.string().regex(/^[0-9a-f-]{36}\/[^/]{1,180}$/i),
    verificationDetails: z.record(z.string(), z.unknown()).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    if (!data.kbisPath.startsWith(`${context.userId}/`)) throw new Error('Document invalide.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: result, error } = await supabaseAdmin.rpc('submit_startup_trial_application', {
      p_siret: data.siret,
      p_legal_name: data.legalName,
      p_creation_date: data.creationDate,
      p_kbis_path: data.kbisPath,
      p_verification_details: data.verificationDetails ?? {},
    });
    if (error) throw new Error(error.message);
    const application = Array.isArray(result) ? result[0] : result;
    return {
      applicationId: application?.application_id ?? null,
      status: application?.application_status ?? 'approved',
      expiresAt: application?.expires_at ?? null,
    };
  });
