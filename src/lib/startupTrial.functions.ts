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

// ---------------------------------------------------------------------------
// Candidatures à validation manuelle (formulaire public → décision admin)
// ---------------------------------------------------------------------------

const SITE_ORIGIN = 'https://crawlers.fr';
const CANDIDATURE_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Formulaire public : crée une candidature « en attente », n'active rien. */
export const submitStartupCandidature = createServerFn({ method: 'POST' })
  .inputValidator((data) => z.object({
    siret: siretSchema,
    activity: z.string().trim().min(2).max(300),
    email: z.string().trim().toLowerCase().email().max(255),
    kbisPdfBase64: z.string().min(100).max(14_000_000),
  }).parse(data))
  .handler(async ({ data }) => {
    const verified = await lookupEligibleCompany(data.siret);
    if (!verified.eligible || !verified.legalName || !verified.creationDate) {
      return { ok: false as const, reason: verified.reason ?? 'Entreprise non éligible.' };
    }
    const binary = Uint8Array.from(atob(data.kbisPdfBase64.replace(/^data:[^,]+,/, '')), (c) => c.charCodeAt(0));
    if (binary.byteLength > 10 * 1024 * 1024) return { ok: false as const, reason: 'Le Kbis dépasse 10 Mo.' };
    if (String.fromCharCode(...binary.slice(0, 5)) !== '%PDF-') return { ok: false as const, reason: 'Le fichier fourni n’est pas un PDF valide.' };

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const [{ data: activated }, { data: open }] = await Promise.all([
      supabaseAdmin.from('startup_trial_applications').select('id').eq('siret', data.siret).maybeSingle(),
      supabaseAdmin.from('startup_trial_candidatures').select('id').eq('siret', data.siret).in('status', ['pending', 'approved']).maybeSingle(),
    ]);
    if (activated) return { ok: false as const, reason: 'Une offre jeune entreprise a déjà été activée pour ce SIRET.' };
    if (open) return { ok: false as const, reason: 'Une candidature est déjà en cours pour ce SIRET.' };

    const { verifyKbisDocument } = await import('@/lib/kbisCheck.server');
    const pdfBuffer = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength) as ArrayBuffer;
    const kbisCheck = await verifyKbisDocument(pdfBuffer, data.siret, verified.legalName);

    const kbisPath = `candidatures/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('startup-trial-kbis')
      .upload(kbisPath, binary, { contentType: 'application/pdf', upsert: false });
    if (uploadError) {
      console.error('[startup-candidature] kbis upload failed', uploadError);
      return { ok: false as const, reason: 'Le dépôt du Kbis a échoué. Réessayez.' };
    }

    const { error } = await supabaseAdmin.from('startup_trial_candidatures').insert({
      company_name: verified.legalName,
      siret: data.siret,
      kbis_path: kbisPath,
      activity: data.activity,
      creation_date: verified.creationDate,
      email: data.email,
      verification_details: { source: 'recherche-entreprises.api.gouv.fr', kbis: { method: 'pdf-text-extraction', ...kbisCheck } },
    });
    if (error) {
      console.error('[startup-candidature] insert failed', error);
      if (error.code === '23505') return { ok: false as const, reason: 'Une candidature est déjà en cours pour ce SIRET.' };
      return { ok: false as const, reason: 'Impossible d’enregistrer la candidature. Réessayez.' };
    }
    return { ok: true as const, reason: null };
  });

async function assertAdmin(context: { supabase: { rpc: (fn: 'has_role', args: { _user_id: string; _role: 'admin' }) => PromiseLike<{ data: boolean | null }> }; userId: string }) {
  const { data } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (!data) throw new Error('Accès réservé aux administrateurs.');
}

/** Admin : liste des candidatures + URL signée (1 h) du Kbis. */
export const listStartupCandidatures = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from('startup_trial_candidatures')
      .select('id, company_name, siret, kbis_path, activity, creation_date, email, submitted_at, status, decided_at, rejection_reason')
      .order('submitted_at', { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const signed = list.length
      ? (await supabaseAdmin.storage.from('startup-trial-kbis').createSignedUrls(list.map((r) => r.kbis_path), 3600)).data ?? []
      : [];
    const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
    return list.map((r) => ({ ...r, kbis_url: urlByPath.get(r.kbis_path) ?? null }));
  });

/** Admin : valider (active 12 mois via le mécanisme existant) ou refuser. */
export const decideStartupCandidature = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    id: z.string().uuid(),
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(1000).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: c, error: readError } = await supabaseAdmin
      .from('startup_trial_candidatures').select('*').eq('id', data.id).maybeSingle();
    if (readError || !c) throw new Error('Candidature introuvable.');
    if (c.status !== 'pending') throw new Error('Cette candidature a déjà été traitée.');

    const now = new Date().toISOString();
    let mode: 'activated' | 'signup_link' | 'rejected' = 'rejected';
    let signupLink: string | null = null;
    const update: Record<string, unknown> = { decided_at: now, decided_by: context.userId };

    if (data.decision === 'reject') {
      update.status = 'rejected';
      update.rejection_reason = data.reason || null;
    } else {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('user_id').ilike('email', c.email).limit(1).maybeSingle();
      const details = { ...(c.verification_details as Record<string, unknown>), manual_review: { decided_by: context.userId, decided_at: now, candidature_id: c.id } };
      if (profile?.user_id) {
        const { error } = await supabaseAdmin.rpc('activate_startup_trial_application', {
          p_user_id: profile.user_id,
          p_siret: c.siret,
          p_legal_name: c.company_name,
          p_creation_date: c.creation_date,
          p_kbis_path: c.kbis_path,
          p_status: 'approved',
          p_verification_details: details,
        });
        if (error) {
          console.error('[startup-candidature] activation failed', error);
          const raw = `${error.message ?? ''}`;
          if (raw.includes('already been claimed')) throw new Error('Une offre a déjà été activée pour ce compte ou ce SIRET.');
          if (raw.includes('not eligible')) throw new Error('Entreprise de plus de 12 mois : activation impossible.');
          throw new Error(`Activation impossible : ${raw || 'erreur inconnue'}`);
        }
        mode = 'activated';
        update.activated_user_id = profile.user_id;
      } else {
        // Lien d'inscription à usage unique, lié à l'email de la candidature (contrôlé au rachat).
        const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const { data: tokenRow, error } = await supabaseAdmin.from('startup_trial_signup_tokens').insert({
          token_hash: await sha256Hex(token),
          siret: c.siret,
          legal_name: c.company_name,
          creation_date: c.creation_date,
          kbis_path: c.kbis_path,
          verification_details: details,
          expires_at: new Date(Date.now() + CANDIDATURE_TOKEN_TTL_MS).toISOString(),
        }).select('id').single();
        if (error || !tokenRow) {
          console.error('[startup-candidature] token creation failed', error);
          throw new Error('Impossible de générer le lien d’inscription.');
        }
        mode = 'signup_link';
        signupLink = `${SITE_ORIGIN}/signup?startup=${encodeURIComponent(token)}`;
        update.signup_token_id = tokenRow.id;
      }
      update.status = 'approved';
    }

    const { error: updateError } = await supabaseAdmin
      .from('startup_trial_candidatures').update(update).eq('id', c.id).eq('status', 'pending');
    if (updateError) throw new Error(updateError.message);

    // Email au candidat : uniquement ici, suite au clic admin.
    const company = escapeHtml(c.company_name);
    let subject: string; let html: string; let text: string;
    if (data.decision === 'reject') {
      const reason = data.reason ? escapeHtml(data.reason) : null;
      subject = 'Votre candidature Offre Jeune Entreprise';
      html = `<div style="font-family:Arial,sans-serif;color:#111;max-width:560px"><p>Bonjour,</p><p>Après vérification, nous ne pouvons pas donner suite à la candidature de <strong>${company}</strong> à l’Offre Jeune Entreprise de Crawlers.fr.</p>${reason ? `<p><strong>Motif :</strong> ${reason}</p>` : ''}<p>Vous pouvez nous répondre si vous pensez qu’il s’agit d’une erreur.</p><p>L’équipe Crawlers.fr</p></div>`;
      text = `Après vérification, nous ne pouvons pas donner suite à la candidature de ${c.company_name}.${data.reason ? ` Motif : ${data.reason}` : ''}`;
    } else if (mode === 'activated') {
      subject = 'Votre plan Pro Agency est activé pour 12 mois';
      html = `<div style="font-family:Arial,sans-serif;color:#111;max-width:560px"><p>Bonjour,</p><p>Bonne nouvelle : la candidature de <strong>${company}</strong> est validée. Le plan Pro Agency est activé sur votre compte pour 12 mois.</p><p><a href="${SITE_ORIGIN}/app/console" style="display:inline-block;border:2px solid #111;color:#111;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Ouvrir ma console</a></p><p>L’équipe Crawlers.fr</p></div>`;
      text = `La candidature de ${c.company_name} est validée : Pro Agency activé 12 mois. ${SITE_ORIGIN}/app/console`;
    } else {
      subject = 'Votre candidature est validée : créez votre compte';
      html = `<div style="font-family:Arial,sans-serif;color:#111;max-width:560px"><p>Bonjour,</p><p>Bonne nouvelle : la candidature de <strong>${company}</strong> est validée. Créez votre compte avec cette adresse email pour activer vos 12 mois de Pro Agency.</p><p><a href="${signupLink}" style="display:inline-block;border:2px solid #111;color:#111;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Créer mon compte</a></p><p>Ce lien est personnel, à usage unique et valable 14 jours.</p><p>L’équipe Crawlers.fr</p></div>`;
      text = `Candidature validée. Créez votre compte avec cette adresse pour activer Pro Agency 12 mois : ${signupLink} (usage unique, 14 jours).`;
    }
    const { error: mailError } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        to: c.email,
        subject,
        html,
        text,
        from: 'noreply@notify.crawlers.fr',
        sender_domain: 'notify.crawlers.fr',
        purpose: 'transactional',
        label: `startup-candidature-${data.decision}`,
        idempotency_key: `startup-candidature-${c.id}-${data.decision}`,
        queued_at: now,
      },
    });
    if (mailError) console.error('[startup-candidature] email enqueue failed', mailError);

    return { mode, emailQueued: !mailError };
  });
