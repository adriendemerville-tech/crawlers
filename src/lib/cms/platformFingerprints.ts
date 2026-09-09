/**
 * Détection de plateforme CMS à partir d'empreintes HTML / en-têtes / cookies.
 * Logique pure et testable : aucune I/O ici.
 */

export type CmsPlatform =
  | 'wordpress'
  | 'shopify'
  | 'webflow'
  | 'wix'
  | 'drupal'
  | 'prestashop'
  | 'odoo';

export const CMS_PLATFORMS: { id: CmsPlatform; label: string }[] = [
  { id: 'wordpress', label: 'WordPress' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'webflow', label: 'Webflow' },
  { id: 'wix', label: 'Wix' },
  { id: 'drupal', label: 'Drupal' },
  { id: 'prestashop', label: 'PrestaShop' },
  { id: 'odoo', label: 'Odoo' },
];

export function platformLabel(id: string): string {
  return CMS_PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

export interface DetectionSignal {
  platform: CmsPlatform;
  /** Preuve lisible, affichable à l'utilisateur. */
  evidence: string;
  weight: number;
}

export interface PlatformDetection {
  platform: CmsPlatform | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  signals: DetectionSignal[];
  /** Autres plateformes ayant reçu au moins un signal. */
  runnersUp: CmsPlatform[];
}

interface Rule {
  platform: CmsPlatform;
  evidence: string;
  weight: number;
  /** Recherche dans le HTML en minuscules. */
  html?: string | RegExp;
  /** Recherche dans « nom: valeur » de tous les en-têtes, en minuscules. */
  header?: string | RegExp;
}

const RULES: Rule[] = [
  // WordPress
  { platform: 'wordpress', evidence: 'Fichiers wp-content détectés', weight: 4, html: '/wp-content/' },
  { platform: 'wordpress', evidence: 'Scripts wp-includes détectés', weight: 3, html: '/wp-includes/' },
  { platform: 'wordpress', evidence: 'Balise generator WordPress', weight: 4, html: /name=["']generator["'][^>]*wordpress/ },
  { platform: 'wordpress', evidence: 'API REST WordPress annoncée', weight: 3, html: '/wp-json/' },
  { platform: 'wordpress', evidence: 'Cookie WordPress', weight: 2, header: 'wordpress_' },

  // Shopify
  { platform: 'shopify', evidence: 'CDN Shopify utilisé', weight: 4, html: 'cdn.shopify.com' },
  { platform: 'shopify', evidence: 'Objet Shopify dans la page', weight: 4, html: 'shopify.theme' },
  { platform: 'shopify', evidence: 'myshopify.com référencé', weight: 3, html: 'myshopify.com' },
  { platform: 'shopify', evidence: 'En-tête serveur Shopify', weight: 4, header: /(x-shopify|server: *cloudflare.*shopify)/ },
  { platform: 'shopify', evidence: 'Cookie panier Shopify', weight: 3, header: '_shopify_' },

  // Webflow
  { platform: 'webflow', evidence: 'Balise generator Webflow', weight: 4, html: /name=["']generator["'][^>]*webflow/ },
  { platform: 'webflow', evidence: 'Ressources Webflow chargées', weight: 3, html: 'assets.website-files.com' },
  { platform: 'webflow', evidence: 'Ressources Webflow chargées', weight: 3, html: 'cdn.prod.website-files.com' },
  { platform: 'webflow', evidence: 'Attribut data-wf-page', weight: 4, html: 'data-wf-page' },

  // Wix
  { platform: 'wix', evidence: 'En-tête serveur Wix', weight: 4, header: 'x-wix-' },
  { platform: 'wix', evidence: 'Ressources statiques Wix', weight: 3, html: 'static.parastorage.com' },
  { platform: 'wix', evidence: 'Balise generator Wix', weight: 4, html: /name=["']generator["'][^>]*wix\.com/ },
  { platform: 'wix', evidence: 'Configuration wixBiSession', weight: 3, html: 'wixbisession' },

  // Drupal
  { platform: 'drupal', evidence: 'Objet Drupal.settings', weight: 4, html: 'drupal.settings' },
  { platform: 'drupal', evidence: 'Balise generator Drupal', weight: 4, html: /name=["']generator["'][^>]*drupal/ },
  { platform: 'drupal', evidence: 'En-tête X-Generator Drupal', weight: 4, header: /x-generator: *drupal/ },
  { platform: 'drupal', evidence: 'Chemins /sites/default/files', weight: 2, html: '/sites/default/files' },

  // PrestaShop
  { platform: 'prestashop', evidence: 'Variable prestashop dans la page', weight: 4, html: 'var prestashop' },
  { platform: 'prestashop', evidence: 'Balise generator PrestaShop', weight: 4, html: /name=["']generator["'][^>]*prestashop/ },
  { platform: 'prestashop', evidence: 'Cookie PrestaShop', weight: 3, header: 'prestashop-' },
  { platform: 'prestashop', evidence: 'Thème PrestaShop détecté', weight: 2, html: '/themes/classic/assets' },

  // Odoo
  { platform: 'odoo', evidence: 'Ressources web.assets d\'Odoo', weight: 4, html: '/web/assets/' },
  { platform: 'odoo', evidence: 'Balise generator Odoo', weight: 4, html: /name=["']generator["'][^>]*odoo/ },
  { platform: 'odoo', evidence: 'Objet odoo dans la page', weight: 3, html: 'odoo.define' },
  { platform: 'odoo', evidence: 'Session Odoo détectée', weight: 3, header: 'session_id=' },
];

export function detectPlatform(html: string, headerLines: string[]): PlatformDetection {
  const h = html.toLowerCase();
  const head = headerLines.join('\n').toLowerCase();

  const scores = new Map<CmsPlatform, number>();
  const signals: DetectionSignal[] = [];

  for (const rule of RULES) {
    const hay = rule.html !== undefined ? h : head;
    const needle = rule.html ?? rule.header;
    if (needle === undefined) continue;
    const hit = typeof needle === 'string' ? hay.includes(needle) : needle.test(hay);
    if (!hit) continue;
    scores.set(rule.platform, (scores.get(rule.platform) ?? 0) + rule.weight);
    signals.push({ platform: rule.platform, evidence: rule.evidence, weight: rule.weight });
  }

  if (scores.size === 0) {
    return { platform: null, confidence: 'none', signals: [], runnersUp: [] };
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [best, bestScore] = ranked[0]!;
  const secondScore = ranked[1]?.[1] ?? 0;

  // Odoo et WordPress partagent des chemins génériques : on exige un écart net.
  const ambiguous = bestScore - secondScore < 2;
  const confidence: PlatformDetection['confidence'] =
    ambiguous ? 'low' : bestScore >= 6 ? 'high' : bestScore >= 3 ? 'medium' : 'low';

  return {
    platform: best,
    confidence,
    signals: signals.filter((s) => s.platform === best),
    runnersUp: ranked.slice(1).map(([p]) => p),
  };
}
