import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { verifyKbisDocument } from '@/lib/kbisCheck.server';

const siretSchema = z.string()
  .transform((value) => value.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{14}$/, 'Le SIRET doit contenir 14 chiffres.'));

type CompanyLookup = {
  nom_complet?: string;
  siege?: { siret?: string };
  date_creation?: string;
  etat_administratif?: string;
};

async function fetchDirectory(siret: string, timeoutMs: number) {
  return fetch(
    `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siret)}&per_page=1`,
    {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json', 'User-Agent': 'crawlers.fr/1.0 (startup-trial)' },
    },
  );
}

async function lookupEligibleCompany(siret: string) {
  // 3 tentatives avec timeouts croissants : l'annuaire officiel est souvent lent en heure de pointe.
  let response: Response | null = null;
  for (const timeoutMs of [8000, 12000, 20000]) {
    try {
      const attempt = await fetchDirectory(siret, timeoutMs);
      if (attempt.ok) { response = attempt; break; }
      if (attempt.status === 404) { response = attempt; break; }
    } catch { /* timeout / réseau : on retente */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!response?.ok) return { eligible: false as const, reason: 'L’annuaire officiel n’a pas répondu à temps. Réessayez dans quelques secondes.' };

  const payload = await response.json() as { results?: CompanyLookup[] };
  const company = payload.results?.find((entry) => entry.siege?.siret === siret) ?? payload.results?.[0];
  if (!company?.date_creation) return { eligible: false as const, reason: 'SIRET introuvable dans l’annuaire officiel.' };


  const creationDate = company.date_creation.slice(0, 10);
  const creation = new Date(`${creationDate}T00:00:00Z`);
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setUTCFullYear(twelveMonthsAgo.getUTCFullYear() - 1);
  const eligible = company.etat_administratif !== 'C' && creation >= twelveMonthsAgo && creation <= now;

  return {
    eligible,
    siret,
    legalName: company.nom_complet ?? 'Entreprise vérifiée',
    creationDate,
    reason: eligible ? null : 'Cette entreprise a plus de 12 mois ou n’est plus active.',
  };
}

export const verifyStartupSiret = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ siret: siretSchema }).parse(data))
  .handler(async ({ data }) => lookupEligibleCompany(data.siret));

export const submitStartupTrial = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    siret: siretSchema,
    legalName: z.string().trim().min(2).max(200),
    creationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kbisPath: z.string().regex(/^[0-9a-f-]{36}\/[^/]{1,180}$/i),
  }).parse(data))
  .handler(async ({ data, context }) => {
    if (!data.kbisPath.startsWith(`${context.userId}/`)) throw new Error('Document invalide.');

    // Le client ne peut pas modifier le nom ou la date après la vérification affichée.
    const verified = await lookupEligibleCompany(data.siret);
    if (!verified.eligible || verified.legalName !== data.legalName || verified.creationDate !== data.creationDate) {
      throw new Error('La vérification de l’entreprise a expiré. Recommencez la vérification du SIRET.');
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: result, error } = await supabaseAdmin.rpc('activate_startup_trial_application', {
      p_user_id: context.userId,
      p_siret: data.siret,
      p_legal_name: data.legalName,
      p_creation_date: data.creationDate,
      p_kbis_path: data.kbisPath,
      p_verification_details: { source: 'recherche-entreprises.api.gouv.fr' },
    });
    if (error) {
      console.error('[startup-trial] activation failed', error);
      const raw = `${error.message ?? ''}`;
      if (raw.includes('already been claimed')) throw new Error('Une offre jeune entreprise a déjà été activée pour ce compte ou ce SIRET.');
      if (raw.includes('not eligible')) throw new Error('Cette entreprise a plus de 12 mois : offre non applicable.');
      if (raw.includes('Invalid Kbis')) throw new Error('Le document Kbis n’a pas été correctement téléversé. Réessayez.');
      if (raw.includes('Server activation required')) throw new Error('Activation indisponible : contactez le support.');
      throw new Error(`Impossible d’activer l’offre : ${raw || 'erreur inconnue'}`);
    }
    const application = Array.isArray(result) ? result[0] : result;
    return {
      applicationId: application?.application_id ?? null,
      status: application?.application_status ?? 'approved',
      expiresAt: application?.expires_at ?? null,
    };
  });
