// Diagnostic helper: given a raw error message returned by the WP/CMS test
// endpoint, returns a translated list of plausible root causes so the user
// always sees that a connection failure can have multiple origins.

export type Lang = 'fr' | 'en' | 'es';

const t = (lang: Lang, fr: string, en: string, es: string) =>
  lang === 'fr' ? fr : lang === 'en' ? en : es;

interface DiagnosisInput {
  message: string;
  status?: number;
  code?: string;
}

export function diagnoseCmsConnectionError(
  input: DiagnosisInput | string,
  lang: Lang = 'fr',
): string[] {
  const raw = typeof input === 'string' ? input : input.message || '';
  const status = typeof input === 'object' ? input.status : undefined;
  const code = typeof input === 'object' ? (input.code || '').toLowerCase() : '';
  const lower = raw.toLowerCase();

  const causes: string[] = [];

  // 401 / rest_not_logged_in → identifiants
  if (status === 401 || /\b401\b/.test(raw) || code.includes('rest_not_logged_in') || lower.includes('not_logged_in')) {
    causes.push(
      t(lang,
        "Identifiant incorrect — utilisez le username WordPress exact (visible dans wp-admin → Profil), pas forcément l'email.",
        'Wrong username — use the exact WordPress username (see wp-admin → Profile), not necessarily the email.',
        'Usuario incorrecto — usa el nombre de usuario WordPress exacto (wp-admin → Perfil), no necesariamente el email.',
      ),
      t(lang,
        "Application Password mal copié — il doit contenir les espaces (6 blocs de 4 caractères).",
        'Application Password incorrectly copied — it must include the spaces (6 groups of 4 chars).',
        'Application Password mal copiado — debe incluir los espacios (6 bloques de 4 caracteres).',
      ),
      t(lang,
        "Application Password généré sur un autre compte que celui saisi ici.",
        'Application Password generated on a different account than the one entered here.',
        'Application Password generado en otra cuenta distinta de la introducida aquí.',
      ),
      t(lang,
        "Rôle utilisateur insuffisant — l'utilisateur doit être au moins Éditeur pour publier via l'API REST.",
        'Insufficient user role — must be at least Editor to publish via REST API.',
        'Rol insuficiente — debe ser al menos Editor para publicar vía API REST.',
      ),
    );
  }

  // 403 → WAF / plugin sécurité / .htaccess
  if (status === 403 || /\b403\b/.test(raw) || lower.includes('forbidden')) {
    causes.push(
      t(lang,
        "Pare-feu serveur (OVH ModSecurity, Cloudflare WAF…) qui bloque l'en-tête Authorization ou les requêtes vers /wp-json/.",
        'Server firewall (OVH ModSecurity, Cloudflare WAF…) blocking the Authorization header or requests to /wp-json/.',
        'Firewall del servidor (OVH ModSecurity, Cloudflare WAF…) bloqueando la cabecera Authorization o las peticiones a /wp-json/.',
      ),
      t(lang,
        "Plugin de sécurité (Wordfence, iThemes Security, SecuPress, WPS Hide Login…) qui restreint l'API REST ou les Application Passwords.",
        'Security plugin (Wordfence, iThemes Security, SecuPress, WPS Hide Login…) restricting REST API or Application Passwords.',
        'Plugin de seguridad (Wordfence, iThemes Security, SecuPress, WPS Hide Login…) que limita la API REST o los Application Passwords.',
      ),
      t(lang,
        "Règle .htaccess personnalisée qui supprime le header Authorization (correctif : SetEnvIf Authorization \"(.*)\" HTTP_AUTHORIZATION=$1).",
        'Custom .htaccess rule stripping the Authorization header (fix: SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1).',
        'Regla .htaccess personalizada que elimina la cabecera Authorization (corrección: SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1).',
      ),
    );
  }

  // 404 → REST API désactivée
  if (status === 404 || /\b404\b/.test(raw) || lower.includes('rest_no_route')) {
    causes.push(
      t(lang,
        "API REST de WordPress désactivée par un plugin (Disable REST API) ou par le thème.",
        'WordPress REST API disabled by a plugin (Disable REST API) or by the theme.',
        'API REST de WordPress desactivada por un plugin (Disable REST API) o por el tema.',
      ),
      t(lang,
        "Permaliens cassés — réenregistrer les permaliens dans wp-admin → Réglages → Permaliens.",
        'Broken permalinks — re-save them at wp-admin → Settings → Permalinks.',
        'Permalinks rotos — vuelve a guardarlos en wp-admin → Ajustes → Permalinks.',
      ),
    );
  }

  // 5xx / timeout / network
  if ((status && status >= 500) || /\b5\d\d\b/.test(raw) || lower.includes('timeout') || lower.includes('econnrefused') || lower.includes('network')) {
    causes.push(
      t(lang,
        "Serveur WordPress momentanément indisponible ou trop lent à répondre.",
        'WordPress server temporarily unavailable or too slow to respond.',
        'Servidor WordPress no disponible temporalmente o demasiado lento.',
      ),
      t(lang,
        "Maintenance, surcharge mutualisé, ou erreur PHP fatale côté site.",
        'Maintenance, shared-host overload, or fatal PHP error on the site.',
        'Mantenimiento, sobrecarga del alojamiento compartido o error PHP fatal en el sitio.',
      ),
    );
  }

  // Fallback générique
  if (causes.length === 0) {
    causes.push(
      t(lang,
        "Identifiants ou Application Password invalides.",
        'Invalid credentials or Application Password.',
        'Credenciales o Application Password no válidos.',
      ),
      t(lang,
        "Pare-feu serveur ou plugin de sécurité qui filtre les requêtes API.",
        'Server firewall or security plugin filtering API requests.',
        'Firewall del servidor o plugin de seguridad filtrando las peticiones API.',
      ),
      t(lang,
        "API REST WordPress désactivée ou URL du site incorrecte (https/http, www).",
        'WordPress REST API disabled or wrong site URL (https/http, www).',
        'API REST de WordPress desactivada o URL del sitio incorrecta (https/http, www).',
      ),
    );
  }

  return causes;
}
