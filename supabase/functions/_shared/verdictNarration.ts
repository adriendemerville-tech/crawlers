/**
 * verdictNarration.ts — Reformulation de la synthèse stratégique.
 *
 * Problème corrigé : `buildStrategicVerdict()` produit un paragraphe 100 %
 * déterministe, donc rigoureusement identique d'un audit à l'autre dès que les
 * mêmes leviers sont activés (« Après analyse, il ressort de notre audit que X
 * poursuit actuellement une stratégie de volume SEO… »). Deux rapports de
 * clients différents se retrouvaient mot pour mot avec la même synthèse.
 *
 * Principe : le déterminisme reste la SOURCE DE VÉRITÉ (posture, leviers,
 * chiffres, fourchette de gain). Le LLM ne fait que *rédiger* ces faits, avec
 * un angle rédactionnel tiré au sort par audit, et sans droit d'inventer un
 * chiffre. Tout écart (chiffre inconnu, longueur aberrante, appel en échec)
 * retombe sur le paragraphe déterministe : jamais de régression de fiabilité.
 *
 * Coût : un seul appel, prompt court (~400 tokens), sortie ~200 tokens.
 */

import { buildStrategicVerdict, type StrategicVerdict, type VerdictSignals } from './strategicVerdict.ts';
import { callRoutedAI } from './aiRouter.ts';

/** Angles rédactionnels : rotation pour éviter la formulation unique. */
const ANGLES_FR = [
  'ouvre par le constat de structure du site, puis enchaîne sur ce qu\'il faut arbitrer',
  'ouvre par l\'écart entre l\'effort déjà fourni et le résultat mesuré',
  'ouvre par la conséquence business du diagnostic, avant les leviers',
  'ouvre par ce qui bloque aujourd\'hui la visibilité, puis l\'ordre de traitement',
  'ouvre par la lecture du positionnement actuel sur son marché',
  'ouvre par le principal risque encouru si rien n\'est arbitré',
];

const OPENING_BANLIST = [
  'après analyse, il ressort de notre audit que',
  'after analysis, our audit finds that',
  'tras el análisis, nuestra auditoría concluye que',
];

function hashSeed(...parts: Array<string | number | null | undefined>): number {
  const s = parts.filter(Boolean).join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Tous les nombres autorisés dans la sortie = ceux présents dans les faits. */
function allowedNumbers(facts: string): Set<string> {
  const set = new Set<string>();
  for (const m of facts.matchAll(/\d+(?:[.,]\d+)?/g)) set.add(m[0].replace(',', '.'));
  return set;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function factSheet(domain: string, v: StrategicVerdict, s: VerdictSignals, criticalCount: number): string {
  const lines = [
    `domaine: ${domain}`,
    `posture mesurée: ${v.posture}`,
    ...(v.seoLevers.length ? [`leviers SEO retenus:\n- ${v.seoLevers.join('\n- ')}`] : []),
    ...(v.geoLevers.length ? [`leviers GEO retenus:\n- ${v.geoLevers.join('\n- ')}`] : []),
    ...(criticalCount > 0 ? [`blocages critiques restant dans le plan d'action: ${criticalCount}`] : []),
    ...(typeof s.techScore === 'number' && s.techScore ? [`score SEO technique: ${s.techScore}/100`] : []),
    ...(typeof s.geoScore === 'number' && s.geoScore ? [`score GEO: ${s.geoScore}/100`] : []),
    ...(v.gain ? [`fourchette de gain de trafic organique à 12 mois: +${v.gain.low} % à +${v.gain.high} %`] : []),
  ];
  return lines.join('\n');
}

export interface NarrationOptions {
  lang?: string;
  /** Graine de variation (id de job, url…) pour ne pas répéter l'angle. */
  seed?: string;
  /** Coupe l'appel LLM (mode économie / test). */
  disableLLM?: boolean;
}

/**
 * Retourne le HTML du bloc verdict : rédigé par LLM si la reformulation est
 * fidèle, sinon le HTML déterministe d'origine.
 */
export async function narrateStrategicVerdict(
  domain: string,
  signals: VerdictSignals,
  opts: NarrationOptions = {},
): Promise<{ html: string; narrated: boolean }> {
  const lang = opts.lang || 'fr';
  const deterministic = buildStrategicVerdict(domain, signals, lang);

  if (opts.disableLLM) return { html: deterministic.html, narrated: false };
  if (!deterministic.seoLevers.length && !deterministic.geoLevers.length) {
    return { html: deterministic.html, narrated: false };
  }

  const criticalCount = Number(signals.criticalCount || 0);
  const facts = factSheet(domain, deterministic, signals, criticalCount);
  const seed = hashSeed(domain, opts.seed, new Date().toISOString().slice(0, 10));
  const angle = ANGLES_FR[seed % ANGLES_FR.length];
  const langLabel = lang === 'en' ? 'anglais' : lang === 'es' ? 'espagnol' : 'français';

  const system = `Tu rédiges la conclusion stratégique d'un audit SEO/GEO professionnel, en ${langLabel}.

RÈGLES ABSOLUES
- Tu ne disposes d'AUCUNE information autre que la fiche de faits fournie. N'ajoute aucun chiffre, aucun nom, aucun concurrent, aucune techno, aucune hypothèse de marché.
- Chaque chiffre que tu écris doit être copié depuis la fiche, sans recalcul.
- N'affirme pas un levier absent de la fiche. Si un sujet n'y figure pas, il n'existe pas.
- Ne commence jamais par « Après analyse, il ressort de notre audit que ».
- Style : analyste senior, phrases denses, aucune emphase creuse, aucun emoji, aucune liste à puces, aucun titre.
- Nomme le domaine au maximum deux fois.
- 3 à 5 phrases, 90 à 160 mots, un seul paragraphe. Réponds uniquement par ce paragraphe, sans balise HTML.

ANGLE IMPOSÉ POUR CETTE RÉDACTION : ${angle}. Hiérarchise librement les leviers de la fiche selon leur gravité réelle et dis lequel doit passer en premier.`;

  try {
    const { content } = await callRoutedAI('marina_verdict_narration', {
      system,
      user: `FICHE DE FAITS MESURÉS\n${facts}`,
      temperature: 0.85,
      maxTokens: 420,
      timeoutMs: 25_000,
      fallbackModel: 'google/gemini-3-flash-preview',
    });

    const text = String(content || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/^\s*[-*#>]+\s*/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    const words = text.split(/\s+/).length;
    if (words < 55 || words > 260) throw new Error(`longueur hors bornes (${words} mots)`);
    if (OPENING_BANLIST.some((b) => text.toLowerCase().startsWith(b))) throw new Error('amorce interdite');

    // Contrôle anti-invention : tout nombre écrit doit venir de la fiche.
    const allowed = allowedNumbers(facts);
    for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
      const num = m[0].replace(',', '.');
      if (!allowed.has(num) && !['100', '12', '1', '2', '3'].includes(num)) {
        throw new Error(`chiffre non mesuré dans la sortie: ${num}`);
      }
    }

    const gainHtml = deterministic.gain
      ? `<p style="font-size:13.5px;line-height:1.7;color:#374151;margin:10px 0 0 0;">
          <strong>Gain de trafic organique possible : +${deterministic.gain.low} % à +${deterministic.gain.high} % sur 12 mois</strong>
          <span style="color:#6b7280;"> — objectif raisonnable, conditionné à la mise en œuvre complète du plan d'action ; fourchette dérivée des leviers mesurés ci-dessus, pas d'une projection de marché.</span>
        </p>`
      : '';

    const html = `
    <div data-marina-block="verdict" data-verdict-mode="narrated" style="margin:14px 0 0 0;padding:12px 14px;border:1px solid #ede9fe;border-left:4px solid #6d28d9;border-radius:8px;background:#faf9ff;">
      <p style="font-size:13.5px;line-height:1.75;color:#111827;margin:0;"><strong>${escapeHtml(text)}</strong></p>
      ${gainHtml}
    </div>`;

    return { html, narrated: true };
  } catch (e) {
    console.warn('[verdictNarration] reformulation rejetée, verdict déterministe conservé:', (e as Error).message);
    return { html: deterministic.html, narrated: false };
  }
}
