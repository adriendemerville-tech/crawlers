/**
 * submitSitemapToGSC.ts
 * 
 * Soumet un sitemap à la Google Search Console via l'API officielle.
 * Endpoint : PUT https://searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}
 * 
 * Les URLs sont encodées via encodeURIComponent() comme l'exige l'API Google.
 * La fonction retourne un objet structuré { success, error? } pour un traitement propre côté appelant.
 */

interface SubmitSitemapParams {
  /** URL du site tel qu'enregistré dans GSC (ex: "https://crawlers.fr") */
  siteUrl: string;
  /** URL complète du sitemap (ex: "https://crawlers.fr/sitemap.xml") */
  feedpath: string;
  /** Token OAuth 2.0 valide avec scope webmasters */
  accessToken: string;
}

interface SubmitSitemapResult {
  success: boolean;
  error?: string;
  /** Code HTTP retourné par Google (utile pour le debug) */
  statusCode?: number;
}

export async function submitSitemapToGSC({
  siteUrl,
  feedpath,
  accessToken,
}: SubmitSitemapParams): Promise<SubmitSitemapResult> {
  // Validation des paramètres
  if (!siteUrl || !feedpath || !accessToken) {
    return { success: false, error: 'Paramètres manquants : siteUrl, feedpath et accessToken sont requis' };
  }

  // Encodage obligatoire des URLs pour l'API Google
  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const encodedFeedpath = encodeURIComponent(feedpath);

  const apiUrl = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/sitemaps/${encodedFeedpath}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Google renvoie 204 No Content en cas de succès pour PUT sitemap
    if (response.ok) {
      console.log(`[submitSitemapToGSC] ✅ Sitemap soumis avec succès : ${feedpath} → ${siteUrl}`);
      return { success: true, statusCode: response.status };
    }

    // Gestion des erreurs connues
    let errorDetail = '';
    try {
      const errorBody = await response.json();
      errorDetail = errorBody?.error?.message || JSON.stringify(errorBody);
    } catch {
      errorDetail = await response.text().catch(() => 'Impossible de lire la réponse');
    }

    const errorMap: Record<number, string> = {
      401: 'Token OAuth expiré ou invalide. Reconnexion Google requise.',
      403: "L'utilisateur n'a pas les droits sur cette propriété GSC.",
      404: "Propriété GSC introuvable. Vérifiez que le site est bien ajouté dans Search Console.",
      429: 'Quota API Google dépassé. Réessayez plus tard.',
    };

    const friendlyMessage = errorMap[response.status] || `Erreur Google API (${response.status})`;
    const fullError = `${friendlyMessage} — Détail : ${errorDetail}`;

    console.error(`[submitSitemapToGSC] ❌ ${fullError}`);
    return { success: false, error: fullError, statusCode: response.status };

  } catch (err) {
    // Erreur réseau (DNS, timeout, etc.)
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[submitSitemapToGSC] ❌ Erreur réseau : ${message}`);
    return { success: false, error: `Erreur réseau lors de l'appel à Google : ${message}` };
  }
}
