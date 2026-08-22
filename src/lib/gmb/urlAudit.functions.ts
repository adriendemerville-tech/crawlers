import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Audit d'une fiche Google Business Profile à partir d'une simple URL
 * (share.google, maps.app.goo.gl, google.com/maps/place, ?kgmid=…) ou d'une
 * saisie « Nom Ville ». Aucun OAuth, aucune propriété de la fiche requise.
 */
export const auditGmbFromUrl = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => {
    const url = String(input?.url ?? '').trim();
    if (url.length < 4) throw new Error("URL ou nom d'établissement requis");
    return { url: url.slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    const apiKey = process.env['GOOGLE_PLACES_API_KEY'];
    if (!apiKey) throw new Error('Service de données locales non configuré');

    const { resolveGoogleUrl } = await import('./urlResolver.server');
    const { findPlaceId, fetchPlaceFacts, fetchWebsiteFacts } = await import('./urlAudit.server');
    const { auditGmbListing } = await import('./listingAudit');

    const resolved = await resolveGoogleUrl(data.url);
    let placeId = resolved.placeId;
    if (!placeId) {
      if (!resolved.textQuery) {
        throw new Error('Lien Google non résolu : aucun établissement identifiable dans cette URL.');
      }
      placeId = await findPlaceId(resolved.textQuery, apiKey);
    }
    if (!placeId) {
      throw new Error(`Aucune fiche Google trouvée pour « ${resolved.textQuery ?? data.url} ».`);
    }

    const place = await fetchPlaceFacts(placeId, resolved.kgmid, apiKey);
    if (!place) throw new Error('Fiche Google inaccessible via le service de données locales.');

    const website = await fetchWebsiteFacts(place);
    const audit = auditGmbListing(place, website);

    const { data: saved, error } = await context.supabase
      .from('gmb_url_audits')
      .insert({
        user_id: context.userId,
        source_url: data.url,
        resolved_url: resolved.resolvedUrl,
        place_id: place.place_id,
        place_name: place.name,
        place_address: place.formatted_address,
        kgmid: place.kgmid,
        score: audit.percent,
        grade: audit.grade,
        result: audit as unknown as Record<string, unknown>,
      })
      .select('id, created_at')
      .maybeSingle();
    if (error) console.error('[auditGmbFromUrl] archivage non bloquant:', error.message);

    return {
      id: saved?.id ?? null,
      created_at: saved?.created_at ?? new Date().toISOString(),
      resolved_url: resolved.resolvedUrl,
      audit,
    };
  });

/** Historique des audits de fiches lancés par l'utilisateur. */
export const listGmbUrlAudits = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('gmb_url_audits')
      .select('id, source_url, place_id, place_name, place_address, score, grade, created_at')
      .eq('user_id', context.userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { audits: data ?? [] };
  });

/** Relit un audit archivé (résultat complet). */
export const getGmbUrlAudit = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error('id requis');
    return { id: String(input.id) };
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from('gmb_url_audits')
      .select('id, source_url, resolved_url, score, grade, result, created_at')
      .eq('id', data.id)
      .eq('user_id', context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error('Audit introuvable');
    return row;
  });
