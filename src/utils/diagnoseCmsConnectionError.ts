// Diagnostic helper for CMS connection failures.
// Returns a pedagogical, structured diagnosis that explicitly tells the user
// WHERE the error comes from (their CMS, their credentials, the network…)
// and lists the most likely causes + concrete actions.

export type Lang = 'fr' | 'en' | 'es';

export type ErrorSide = 'cms' | 'credentials' | 'network' | 'config' | 'unknown';

export interface CmsDiagnosis {
  /** Short headline, e.g. "Erreur 403 — votre CMS bloque la connexion". */
  headline: string;
  /** Where the problem lives. Drives the colored badge in the UI. */
  side: ErrorSide;
  /** Label for the side badge, already translated. */
  sideLabel: string;
  /** One-sentence pedagogical explanation. */
  explanation: string;
  /** Most likely causes (bulleted). */
  causes: string[];
  /** Concrete next steps the user can try. */
  actions: string[];
}

interface DiagnosisInput {
  message: string;
  status?: number;
  code?: string;
}

const t = (lang: Lang, fr: string, en: string, es: string) =>
  lang === 'fr' ? fr : lang === 'en' ? en : es;

const sideLabel = (side: ErrorSide, lang: Lang) => {
  switch (side) {
    case 'cms':
      return t(lang, 'Côté CMS', 'CMS side', 'Lado CMS');
    case 'credentials':
      return t(lang, 'Côté identifiants', 'Credentials side', 'Lado credenciales');
    case 'network':
      return t(lang, 'Côté serveur / réseau', 'Server / network side', 'Lado servidor / red');
    case 'config':
      return t(lang, 'Côté configuration', 'Configuration side', 'Lado configuración');
    default:
      return t(lang, 'Origine indéterminée', 'Unknown origin', 'Origen desconocido');
  }
};

export function diagnoseCmsConnectionError(
  input: DiagnosisInput | string,
  lang: Lang = 'fr',
): CmsDiagnosis {
  const raw = typeof input === 'string' ? input : input.message || '';
  const status = typeof input === 'object' ? input.status : undefined;
  const code = typeof input === 'object' ? (input.code || '').toLowerCase() : '';
  const lower = raw.toLowerCase();

  // ─── 401 : identifiants refusés ───
  if (status === 401 || /\b401\b/.test(raw) || code.includes('rest_not_logged_in') || lower.includes('not_logged_in')) {
    return {
      side: 'credentials',
      sideLabel: sideLabel('credentials', lang),
      headline: t(lang,
        'Erreur 401 — vos identifiants ont été refusés',
        'Error 401 — your credentials were rejected',
        'Error 401 — tus credenciales fueron rechazadas',
      ),
      explanation: t(lang,
        "Votre CMS a bien reçu la demande mais a refusé le couple identifiant + mot de passe d'application. Le problème vient presque toujours de ce qui a été saisi ici, pas du CMS lui-même.",
        'Your CMS received the request but rejected the username + application password pair. The problem almost always comes from what was entered here, not from the CMS itself.',
        'Tu CMS recibió la petición pero rechazó el usuario + application password. El problema casi siempre viene de lo introducido aquí, no del CMS.',
      ),
      causes: [
        t(lang,
          "Identifiant incorrect : utilisez le username WordPress exact (visible dans wp-admin → Profil), pas forcément l'email.",
          'Wrong username: use the exact WordPress username (wp-admin → Profile), not necessarily the email.',
          'Usuario incorrecto: usa el nombre de usuario WordPress exacto (wp-admin → Perfil), no necesariamente el email.',
        ),
        t(lang,
          "Application Password mal copié : il doit contenir les espaces (6 blocs de 4 caractères).",
          'Application Password mis-copied: it must include the spaces (6 groups of 4 chars).',
          'Application Password mal copiado: debe incluir los espacios (6 bloques de 4 caracteres).',
        ),
        t(lang,
          "Application Password généré sur un autre compte que celui saisi ici.",
          'Application Password generated on a different account than the one entered here.',
          'Application Password generado en otra cuenta distinta de la introducida aquí.',
        ),
        t(lang,
          "Rôle utilisateur insuffisant : l'utilisateur doit être au moins Éditeur pour publier via l'API REST.",
          'Insufficient role: the user must be at least Editor to publish via REST API.',
          'Rol insuficiente: el usuario debe ser al menos Editor para publicar vía API REST.',
        ),
      ],
      actions: [
        t(lang,
          "Régénérez un nouvel Application Password dans wp-admin → Profil → Mots de passe d'application, puis recollez-le ici tel quel (avec les espaces).",
          'Regenerate a new Application Password at wp-admin → Profile → Application Passwords, then paste it here as-is (with spaces).',
          'Genera un nuevo Application Password en wp-admin → Perfil → Application Passwords y pégalo aquí tal cual (con espacios).',
        ),
      ],
    };
  }

  // ─── 403 : CMS / WAF bloque ───
  if (status === 403 || /\b403\b/.test(raw) || lower.includes('forbidden')) {
    return {
      side: 'cms',
      sideLabel: sideLabel('cms', lang),
      headline: t(lang,
        'Erreur 403 — votre CMS bloque la connexion (sécurité par défaut)',
        'Error 403 — your CMS is blocking the connection (default security)',
        'Error 403 — tu CMS bloquea la conexión (seguridad por defecto)',
      ),
      explanation: t(lang,
        "Le serveur du CMS a reçu la demande et l'a rejetée AVANT même de vérifier vos identifiants. Cela vient d'un pare-feu, d'un plugin de sécurité ou d'une règle serveur — pas de Crawlers, ni de vos identifiants.",
        'The CMS server received the request and rejected it BEFORE even checking your credentials. This comes from a firewall, a security plugin or a server rule — not from Crawlers, nor from your credentials.',
        'El servidor del CMS recibió la petición y la rechazó ANTES de comprobar tus credenciales. Viene de un firewall, plugin de seguridad o regla del servidor — no de Crawlers ni de tus credenciales.',
      ),
      causes: [
        t(lang,
          "Pare-feu de l'hébergeur (OVH ModSecurity, Cloudflare WAF…) qui bloque l'en-tête Authorization ou les requêtes vers /wp-json/.",
          "Hosting firewall (OVH ModSecurity, Cloudflare WAF…) blocking the Authorization header or requests to /wp-json/.",
          "Firewall del alojamiento (OVH ModSecurity, Cloudflare WAF…) bloqueando la cabecera Authorization o las peticiones a /wp-json/.",
        ),
        t(lang,
          "Plugin de sécurité (Wordfence, iThemes Security, SecuPress, WPS Hide Login…) qui restreint l'API REST ou les Application Passwords.",
          'Security plugin (Wordfence, iThemes Security, SecuPress, WPS Hide Login…) restricting REST API or Application Passwords.',
          'Plugin de seguridad (Wordfence, iThemes Security, SecuPress, WPS Hide Login…) limitando la API REST o los Application Passwords.',
        ),
        t(lang,
          ".htaccess personnalisé qui supprime le header Authorization (très fréquent en hébergement mutualisé OVH).",
          'Custom .htaccess stripping the Authorization header (very common on OVH shared hosting).',
          '.htaccess personalizado que elimina la cabecera Authorization (muy frecuente en alojamiento compartido OVH).',
        ),
      ],
      actions: [
        t(lang,
          'Demandez à votre développeur ou à votre hébergeur d\'autoriser l\'API REST WordPress et de préserver l\'en-tête Authorization (règle .htaccess : SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1).',
          'Ask your developer or host to allow the WordPress REST API and preserve the Authorization header (.htaccess rule: SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1).',
          'Pide a tu desarrollador o al hosting que permita la API REST de WordPress y preserve la cabecera Authorization (regla .htaccess: SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1).',
        ),
        t(lang,
          'Désactivez temporairement les plugins de sécurité un par un pour identifier le coupable.',
          'Temporarily disable security plugins one by one to identify the culprit.',
          'Desactiva los plugins de seguridad uno a uno para identificar el culpable.',
        ),
      ],
    };
  }

  // ─── 404 : REST API absente ───
  if (status === 404 || /\b404\b/.test(raw) || lower.includes('rest_no_route')) {
    return {
      side: 'cms',
      sideLabel: sideLabel('cms', lang),
      headline: t(lang,
        'Erreur 404 — l\'API REST de votre CMS est introuvable',
        'Error 404 — your CMS REST API is missing',
        'Error 404 — la API REST de tu CMS no se encuentra',
      ),
      explanation: t(lang,
        "L'URL /wp-json/ n'a renvoyé aucune réponse. L'API REST de WordPress est désactivée, masquée par un plugin, ou les permaliens sont cassés. Cela se règle uniquement côté CMS.",
        '/wp-json/ returned nothing. The WordPress REST API is disabled, hidden by a plugin, or permalinks are broken. This can only be fixed on the CMS side.',
        '/wp-json/ no devolvió nada. La API REST de WordPress está desactivada, oculta por un plugin o los permalinks rotos. Solo se arregla en el CMS.',
      ),
      causes: [
        t(lang,
          'Plugin "Disable REST API" ou équivalent activé sur le site.',
          '"Disable REST API" plugin or equivalent active on the site.',
          'Plugin "Disable REST API" o equivalente activo en el sitio.',
        ),
        t(lang,
          'Permaliens cassés depuis une migration ou un changement de thème.',
          'Permalinks broken after a migration or theme change.',
          'Permalinks rotos tras una migración o cambio de tema.',
        ),
        t(lang,
          'URL du site incorrecte (manque le https://, ou redirige vers www).',
          'Wrong site URL (missing https://, or redirects to www).',
          'URL del sitio incorrecta (sin https:// o redirige a www).',
        ),
      ],
      actions: [
        t(lang,
          'Allez sur wp-admin → Réglages → Permaliens et cliquez sur "Enregistrer" sans rien changer.',
          'Go to wp-admin → Settings → Permalinks and click "Save" without changing anything.',
          'Ve a wp-admin → Ajustes → Enlaces permanentes y haz clic en "Guardar" sin cambiar nada.',
        ),
        t(lang,
          'Vérifiez qu\'aucun plugin ne désactive l\'API REST (cherchez "REST" dans la liste des extensions).',
          'Make sure no plugin disables the REST API (search "REST" in your plugins list).',
          'Comprueba que ningún plugin desactive la API REST (busca "REST" en la lista de plugins).',
        ),
      ],
    };
  }

  // ─── 5xx / timeout / network ───
  if ((status && status >= 500) || /\b5\d\d\b/.test(raw) || lower.includes('timeout') || lower.includes('econnrefused') || lower.includes('network') || lower.includes('fetch failed')) {
    return {
      side: 'network',
      sideLabel: sideLabel('network', lang),
      headline: t(lang,
        'Erreur serveur — votre CMS n\'a pas répondu correctement',
        'Server error — your CMS did not respond properly',
        'Error de servidor — tu CMS no respondió correctamente',
      ),
      explanation: t(lang,
        "Le serveur qui héberge votre CMS est momentanément indisponible, surchargé, ou rencontre une erreur PHP. Ce n'est ni Crawlers ni vos identifiants — c'est l'hébergement du site.",
        'The server hosting your CMS is temporarily unavailable, overloaded, or hitting a PHP error. This is neither Crawlers nor your credentials — it is the site hosting.',
        'El servidor que aloja tu CMS está temporalmente no disponible, sobrecargado o con un error PHP. No es Crawlers ni tus credenciales — es el alojamiento del sitio.',
      ),
      causes: [
        t(lang,
          'Hébergeur en maintenance ou en surcharge (mutualisé OVH, o2switch, Hostinger…).',
          'Host in maintenance or overloaded (shared OVH, o2switch, Hostinger…).',
          'Alojamiento en mantenimiento o sobrecargado (compartido OVH, o2switch, Hostinger…).',
        ),
        t(lang,
          'Erreur PHP fatale côté site (plugin incompatible, mémoire dépassée).',
          'Fatal PHP error on the site (incompatible plugin, out of memory).',
          'Error PHP fatal en el sitio (plugin incompatible, memoria agotada).',
        ),
      ],
      actions: [
        t(lang,
          'Réessayez dans quelques minutes. Si le problème persiste, contactez votre hébergeur.',
          'Try again in a few minutes. If it persists, contact your host.',
          'Vuelve a intentarlo en unos minutos. Si persiste, contacta con tu alojamiento.',
        ),
      ],
    };
  }

  // ─── Fallback ───
  return {
    side: 'unknown',
    sideLabel: sideLabel('unknown', lang),
    headline: t(lang,
      'Connexion impossible — origine à identifier',
      'Connection failed — origin to be identified',
      'Conexión imposible — origen por identificar',
    ),
    explanation: t(lang,
      "Une erreur de connexion peut venir de trois endroits : vos identifiants, votre CMS (pare-feu/plugin), ou son hébergement. Essayez les pistes ci-dessous une par une.",
      'A connection error can come from three places: your credentials, your CMS (firewall/plugin), or its hosting. Try the suggestions below one by one.',
      'Un error de conexión puede venir de tres sitios: tus credenciales, tu CMS (firewall/plugin) o su alojamiento. Prueba las sugerencias abajo una a una.',
    ),
    causes: [
      t(lang,
        'Identifiant ou Application Password invalide.',
        'Invalid username or Application Password.',
        'Usuario o Application Password no válido.',
      ),
      t(lang,
        'Pare-feu serveur ou plugin de sécurité qui filtre les requêtes API.',
        'Server firewall or security plugin filtering API requests.',
        'Firewall del servidor o plugin de seguridad filtrando las peticiones API.',
      ),
      t(lang,
        'API REST WordPress désactivée ou URL du site incorrecte (https/http, www).',
        'WordPress REST API disabled or wrong site URL (https/http, www).',
        'API REST de WordPress desactivada o URL del sitio incorrecta (https/http, www).',
      ),
    ],
    actions: [],
  };
}
