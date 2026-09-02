import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';


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

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parcours public : vérification SIRET + Kbis sans compte.
 * Si le Kbis est conforme, un jeton à usage unique (24 h) encode la gratuité ;
 * l'utilisateur est ensuite redirigé vers l'inscription avec ce jeton.
 */
export const claimStartupTrialToken = createServerFn({ method: 'POST' })
  .inputValidator((data) => z.object({
    siret: siretSchema,
    // 10 Mo de PDF encodé en base64 nécessitent environ 14 Mo de texte.
    kbisPdfBase64: z.string().min(100).max(14_000_000),
  }).parse(data))
  .handler(async ({ data }) => {
    const verified = await lookupEligibleCompany(data.siret);
    if (!verified.eligible || !verified.legalName || !verified.creationDate) {
      return { status: 'rejected' as const, reason: verified.reason ?? 'Entreprise non éligible.', token: null, legalName: null };
    }

    const binary = Uint8Array.from(atob(data.kbisPdfBase64.replace(/^data:[^,]+,/, '')), (c) => c.charCodeAt(0));
    if (binary.byteLength > 10 * 1024 * 1024) {
      return { status: 'rejected' as const, reason: 'Le Kbis dépasse 10 Mo.', token: null, legalName: null };
    }
    if (String.fromCharCode(...binary.slice(0, 5)) !== '%PDF-') {
      return { status: 'rejected' as const, reason: 'Le fichier fourni n’est pas un PDF valide.', token: null, legalName: null };
    }

    const { verifyKbisDocument } = await import('@/lib/kbisCheck.server');
    const pdfBuffer = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength) as ArrayBuffer;
    const kbisCheck = await verifyKbisDocument(pdfBuffer, data.siret, verified.legalName);

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const kbisPath = `claims/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('startup-trial-kbis')
      .upload(kbisPath, binary, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      console.error('[startup-trial] kbis upload failed', uploadError);
      return { status: 'rejected' as const, reason: 'Le dépôt du Kbis a échoué. Réessayez.', token: null, legalName: null };
    }

    if (!kbisCheck.ok) {
      return { status: 'review' as const, reason: kbisCheck.reason, token: null, legalName: verified.legalName };
    }

    const { data: existing } = await supabaseAdmin
      .from('startup_trial_applications')
      .select('id')
      .eq('siret', data.siret)
      .maybeSingle();
    if (existing) {
      return { status: 'rejected' as const, reason: 'Une offre jeune entreprise a déjà été activée pour ce SIRET.', token: null, legalName: null };
    }

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const tokenHash = await sha256Hex(token);
    await supabaseAdmin
      .from('startup_trial_signup_tokens')
      .update({ status: 'expired' })
      .eq('siret', data.siret)
      .eq('status', 'pending');
    const { error: tokenError } = await supabaseAdmin.from('startup_trial_signup_tokens').insert({
      token_hash: tokenHash,
      siret: data.siret,
      legal_name: verified.legalName,
      creation_date: verified.creationDate,
      kbis_path: kbisPath,
      verification_details: { source: 'recherche-entreprises.api.gouv.fr', kbis: { method: 'pdf-text-extraction', ...kbisCheck } },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (tokenError) {
      console.error('[startup-trial] token creation failed', tokenError);
      return { status: 'rejected' as const, reason: 'Impossible de générer votre accès. Réessayez.', token: null, legalName: null };
    }

    return { status: 'approved' as const, reason: null, token, legalName: verified.legalName };
  });

/** Consomme le jeton de gratuité après création du compte et active Pro Agency 12 mois. */
export const redeemStartupTrialToken = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ token: z.string().trim().min(32).max(128) }).parse(data))
  .handler(async ({ data, context }) => {
    const tokenHash = await sha256Hex(data.token);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: result, error } = await supabaseAdmin.rpc('redeem_startup_trial_signup_token', {
      p_token_hash: tokenHash,
      p_user_id: context.userId,
    });
    if (error) {
      const raw = `${error.message ?? ''}`;
      if (raw.includes('already used')) throw new Error('Ce lien de gratuité a déjà été utilisé.');
      if (raw.includes('expired')) throw new Error('Ce lien de gratuité a expiré : recommencez la vérification.');
      if (raw.includes('already been claimed')) throw new Error('Une offre jeune entreprise a déjà été activée pour ce compte ou ce SIRET.');
      if (raw.includes('Unknown startup trial token')) throw new Error('Lien de gratuité invalide.');
      console.error('[startup-trial] redeem failed', error);
      throw new Error('Activation impossible pour le moment.');
    }
    const row = Array.isArray(result) ? result[0] : result;
    return {
      applicationId: row?.application_id ?? null,
      expiresAt: row?.expires_at ?? null,
      legalName: row?.legal_name ?? null,
    };
  });

export const verifyStartupSiret = createServerFn({ method: 'POST' })
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
    const { data: document, error: downloadError } = await supabaseAdmin.storage
      .from('startup-trial-kbis')
      .download(data.kbisPath);
    if (downloadError || !document) {
      throw new Error('Le Kbis est introuvable dans l’espace sécurisé. Téléversez-le à nouveau.');
    }
    if (document.size > 10 * 1024 * 1024) {
      throw new Error('Le Kbis dépasse la taille maximale autorisée de 10 Mo.');
    }

    const pdfBytes = await document.arrayBuffer();
    const header = new Uint8Array(pdfBytes.slice(0, 5));
    if (String.fromCharCode(...header) !== '%PDF-') {
      throw new Error('Le fichier fourni n’est pas un PDF valide.');
    }
    const { verifyKbisDocument } = await import('@/lib/kbisCheck.server');
    const kbisCheck = await verifyKbisDocument(pdfBytes, data.siret, data.legalName);
    const verificationDetails = {
      source: 'recherche-entreprises.api.gouv.fr',
      kbis: { method: 'pdf-text-extraction', ...kbisCheck },
    };
    const status = kbisCheck.ok ? 'approved' : 'review';

    const { data: result, error } = await supabaseAdmin.rpc('activate_startup_trial_application', {
      p_user_id: context.userId,
      p_siret: data.siret,
      p_legal_name: data.legalName,
      p_creation_date: data.creationDate,
      p_kbis_path: data.kbisPath,
      p_status: status,
      p_verification_details: verificationDetails,
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
      status: application?.application_status ?? status,
      expiresAt: application?.expires_at ?? null,
      kbisCheck,
    };
  });
