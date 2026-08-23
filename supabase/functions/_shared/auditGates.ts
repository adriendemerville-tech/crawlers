/**
 * _shared/auditGates.ts — Plafonds de cohérence unifiés (« gates »)
 *
 * Un audit ne doit jamais afficher un score confortable qu'un fait mesuré du
 * même rapport contredit. Deux moteurs produisent aujourd'hui des plafonds :
 *
 *   - audit-expert-seo : LCP « poor », texte visible quasi absent, mesures
 *     PageSpeed indisponibles, bridage global du /200.
 *   - geoSubSignals    : citabilité et mise en forme des réponses plafonnées
 *     quand le texte réellement extrait est quasi nul (coquille JS).
 *
 * Ce module normalise les deux familles dans une seule liste ordonnée, la rend
 * en HTML (« Pourquoi c'est prioritaire ») et la pousse en tête du workbench
 * pour que Parménion et le Stratège traitent la cause racine avant les
 * symptômes de balisage.
 *
 * Aucun appel LLM, aucune dépendance : agrégation déterministe.
 */

export type GateSource = 'technical' | 'geo';

export interface AuditGate {
  /** Axe plafonné : performance | technical | semantic | estimated | total | geo_* */
  axis: string;
  /** Cause, en une phrase lisible par un non-technicien. */
  reason: string;
  /** Preuve chiffrée : « valeur mesurée → cible (effet du plafond) ». */
  evidence: string;
  source: GateSource;
  /** Rang d'entrée : 1 = cause racine, à traiter avant tout le reste. */
  rank: number;
  /**
   * Nombre de points retirés au score par ce plafond. Rendu explicite dans la
   * synthèse : un plafond annoncé sans son coût chiffré n'est pas vérifiable.
   */
  pointsLost?: number | null;
  /** Valeur mesurée et cible isolées quand elles sont exploitables en base. */
  measured?: string | null;
  target?: string | null;
}


/**
 * Ordre d'entrée. Le rendu du contenu passe avant tout : un HTML sans texte
 * rend inutile toute correction de balisage ou de performance. Les axes
 * « estimé » et « total » ferment la liste : ils décrivent la fiabilité de la
 * mesure, pas un défaut du site.
 */
const AXIS_RANK: Array<[RegExp, number]> = [
  [/^technical$/, 1],
  [/^geo_/, 2],
  [/^semantic$/, 3],
  [/^performance$/, 4],
  [/^total$/, 8],
  [/^estimated$/, 9],
];

function rankFor(axis: string): number {
  for (const [re, r] of AXIS_RANK) if (re.test(axis)) return r;
  return 5;
}

const AXIS_LABEL: Record<string, { fr: string; en: string }> = {
  technical: { fr: 'Contenu servi aux robots', en: 'Content served to bots' },
  semantic: { fr: 'Corps de texte lisible', en: 'Readable body text' },
  performance: { fr: 'Performance mobile mesurée', en: 'Measured mobile performance' },
  estimated: { fr: 'Fiabilité des mesures', en: 'Measurement reliability' },
  total: { fr: 'Score global bridé', en: 'Global score capped' },
  geo_quotability: { fr: 'Citabilité IA plafonnée', en: 'AI citability capped' },
  geo_formatting: { fr: 'Mise en forme des réponses plafonnée', en: 'Answer formatting capped' },
  geo_structured_data: { fr: 'Données structurées plafonnées', en: 'Structured data capped' },
  geo_comprehension: { fr: 'Compréhension machine bridée', en: 'Machine comprehension capped' },
};

export function gateAxisLabel(axis: string, lang?: string): string {
  const l = AXIS_LABEL[axis];
  if (!l) return axis;
  return lang === 'en' ? l.en : l.fr;
}

/** Normalise les plafonds bruts d'un moteur en gates ordonnés et dédoublonnés. */
export function normalizeGates(
  raw: Array<{ axis?: string; reason?: string; evidence?: string; pointsLost?: number | null; measured?: string | null; target?: string | null }> | null | undefined,
  source: GateSource,
): AuditGate[] {
  if (!Array.isArray(raw)) return [];
  const out: AuditGate[] = [];
  const seen = new Set<string>();
  for (const g of raw) {
    const axis = String(g?.axis || '').trim();
    const reason = String(g?.reason || '').trim();
    if (!axis || !reason) continue;
    const key = `${source}|${axis}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const lost = Number(g?.pointsLost);
    out.push({
      axis,
      reason,
      evidence: String(g?.evidence || '').trim(),
      source,
      rank: rankFor(axis),
      pointsLost: Number.isFinite(lost) && lost > 0 ? Math.round(lost) : null,
      measured: g?.measured ?? null,
      target: g?.target ?? null,
    });
  }
  return out;
}


/** Fusionne plusieurs listes et les trie par rang d'entrée. */
export function mergeGates(...lists: Array<AuditGate[] | null | undefined>): AuditGate[] {
  const all: AuditGate[] = [];
  const seen = new Set<string>();
  for (const l of lists) {
    for (const g of l || []) {
      const key = `${g.source}|${g.axis}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(g);
    }
  }
  return all.sort((a, b) => a.rank - b.rank);
}

// ═══════════════════════════════════════════════
// Rendu HTML (charte Crawlers : violet, or, noir, blanc — aucun fond plein)
// ═══════════════════════════════════════════════

const VIOLET = '#6d28d9';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Bloc « Pourquoi c'est prioritaire » : chaque gate activé avec son rang
 * d'entrée et sa preuve chiffrée (valeur mesurée vs cible).
 */
export function gatesPriorityBlockHTML(gates: AuditGate[], lang?: string, scope?: 'page' | 'site'): string {
  if (!Array.isArray(gates) || gates.length === 0) return '';
  const isEn = lang === 'en';
  const t = (fr: string, en: string) => (isEn ? en : fr);

  const rows = gates
    .map((g, i) => `<li style="margin:0 0 8px 0;">
      <span style="font-size:11px;font-weight:700;color:${VIOLET};">${t('Entrée', 'Entry')} ${i + 1}</span>
      <span style="font-size:12.5px;font-weight:600;color:#111827;"> — ${esc(gateAxisLabel(g.axis, lang))}</span>
      <br><span style="font-size:12px;color:#374151;line-height:1.6;">${esc(g.reason)}</span>
      ${g.evidence ? `<br><span style="font-size:11.5px;color:#6b7280;">${esc(g.evidence)}</span>` : ''}
    </li>`)
    .join('');

  return `<div style="margin-top:14px;padding:12px 14px;border:1px solid #e5e7eb;border-left:3px solid ${VIOLET};border-radius:8px;background:#ffffff;page-break-inside:avoid;text-align:left;">
    <p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;margin:0 0 6px 0;">${t('Pourquoi c’est prioritaire', 'Why this comes first')}</p>
    <p style="font-size:12px;color:#374151;line-height:1.6;margin:0 0 8px 0;">${t(
      scope === 'site'
        ? 'Ces plafonds sont mesurés sur le domaine : ils bornent le score et fixent l’ordre de traitement du plan.'
        : 'Ces plafonds sont mesurés sur cette URL : ils bornent son score et fixent l’ordre des correctifs. Tant que l’entrée 1 n’est pas levée, les entrées suivantes ne peuvent pas produire leur effet.',
      scope === 'site'
        ? 'These caps are measured on the domain: they bound the score and set the order of the plan.'
        : 'These caps are measured on this URL: they bound its score and set the order of fixes. Until entry 1 is lifted, the following entries cannot deliver their effect.',
    )}</p>
    <ol style="padding-left:20px;margin:0;list-style:decimal;">${rows}</ol>
  </div>`;
}

/**
 * Bloc de la synthèse exécutive : dit explicitement que le score SEO est grevé
 * par la performance mobile et le LCP, et de combien de points exactement.
 *
 * En France, l'essentiel des sessions est mobile : un LCP « poor » n'est pas un
 * détail de confort, il conditionne le score et le classement. Le lecteur doit
 * donc voir le montant du prélèvement, pas seulement l'existence d'un plafond.
 */
export function scorePenaltyBlockHTML(
  gates: AuditGate[],
  lang?: string,
  opts?: { lcpMs?: number | null; techMax?: number | null },
): string {
  if (!Array.isArray(gates) || gates.length === 0) return '';
  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const t = (fr: string, en: string, es: string) => (isEn ? en : isEs ? es : fr);

  const perf = gates.find((g) => g.axis === 'performance' && (g.pointsLost || 0) > 0);
  const total = gates.find((g) => g.axis === 'total' && (g.pointsLost || 0) > 0);
  const others = gates.filter(
    (g) => g.axis !== 'performance' && g.axis !== 'total' && (g.pointsLost || 0) > 0,
  );
  // Sans coût chiffré, ce bloc n'aurait rien à affirmer : on ne l'affiche pas.
  if (!perf && !total) return '';

  const lcpS = opts?.lcpMs && Number.isFinite(opts.lcpMs)
    ? `${(Number(opts.lcpMs) / 1000).toFixed(2)} s`
    : perf?.measured || null;
  const techMax = Number(opts?.techMax) > 0 ? Math.round(Number(opts.techMax)) : 200;

  const lines: string[] = [];

  if (perf) {
    lines.push(
      t(
        `La performance mobile grève le score SEO de <strong>${perf.pointsLost} points</strong> sur ${techMax}. ${
          lcpS ? `Le LCP mobile mesuré est de ${lcpS}` : 'Le LCP mobile mesuré dépasse le seuil Core Web Vitals'
        } pour une cible de 2,50 s : l’axe performance est ramené au plafond (${perf.evidence || 'plafond de cohérence appliqué'}).`,

        `Mobile performance costs the SEO score <strong>${perf.pointsLost} points</strong> out of ${techMax}. ${
          lcpS ? `Measured LCP is ${lcpS}` : 'Measured LCP exceeds the Core Web Vitals threshold'
        } against a 2.50 s target: ${perf.evidence || ''}`.replace(/\s+$/, ''),
        `El rendimiento móvil resta <strong>${perf.pointsLost} puntos</strong> de ${techMax}. ${perf.evidence || ''}`,
      ),
    );
  }

  if (total) {
    lines.push(
      t(
        `Le plafond de cohérence retire <strong>${total.pointsLost} points</strong> supplémentaires au total affiché (${total.measured} avant plafond → ${total.target}) : un défaut bloquant mesuré interdit la zone « excellent ».`,
        `The coherence cap removes <strong>${total.pointsLost} further points</strong> from the displayed total (${total.measured} before cap → ${total.target}): a measured blocking defect rules out the "excellent" band.`,
        `El techo de coherencia resta <strong>${total.pointsLost} puntos</strong> más (${total.measured} → ${total.target}).`,
      ),
    );
  }

  if (others.length) {
    lines.push(
      t(
        `Autres prélèvements mesurés : ${others.map((g) => `${gateAxisLabel(g.axis, lang)} −${g.pointsLost}`).join(' ; ')}.`,
        `Other measured deductions: ${others.map((g) => `${gateAxisLabel(g.axis, lang)} −${g.pointsLost}`).join('; ')}.`,
        `Otras deducciones: ${others.map((g) => `${gateAxisLabel(g.axis, lang)} −${g.pointsLost}`).join('; ')}.`,
      ),
    );
  }

  const grand = (perf?.pointsLost || 0) + (total?.pointsLost || 0)
    + others.reduce((s, g) => s + (g.pointsLost || 0), 0);

  return `<div style="margin-top:14px;padding:12px 14px;border:1px solid #e5e7eb;border-left:3px solid ${VIOLET};border-radius:8px;background:#ffffff;page-break-inside:avoid;text-align:left;">
    <p style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280;margin:0 0 6px 0;">${t(
      'Ce que la performance mobile coûte au score',
      'What mobile performance costs the score',
      'Lo que el rendimiento móvil cuesta al score',
    )}</p>
    ${lines.map((l) => `<p style="font-size:12.5px;color:#374151;line-height:1.7;margin:0 0 6px 0;">${l}</p>`).join('')}
    <p style="font-size:12.5px;color:#111827;line-height:1.7;margin:0 0 6px 0;font-weight:600;">${t(
      `Total prélevé par ces plafonds : −${grand} points.`,
      `Total deducted by these caps: −${grand} points.`,
      `Total deducido: −${grand} puntos.`,
    )}</p>
    <p style="font-size:11.5px;color:#6b7280;line-height:1.6;margin:0;">${t(
      'La navigation mobile représente l’essentiel des sessions en France : le LCP mobile n’est pas un critère de confort, c’est le premier facteur de perte de score et de position.',
      'Mobile browsing accounts for most sessions in France: mobile LCP is not a comfort criterion, it is the first driver of score and ranking loss.',
      'La navegación móvil concentra la mayoría de las sesiones en Francia.',
    )}</p>
  </div>`;
}


// ═══════════════════════════════════════════════
// Workbench : les gates entrent en tête de file
// ═══════════════════════════════════════════════

const AXIS_CATEGORY: Record<string, string> = {
  technical: 'thin_content',
  semantic: 'thin_content',
  performance: 'performance',
  estimated: 'geo_visibility',
  total: 'geo_visibility',
  geo_quotability: 'geo_visibility',
  geo_formatting: 'geo_visibility',
  geo_structured_data: 'structured_data',
  geo_comprehension: 'geo_visibility',
};

/**
 * Upsert des gates dans architect_workbench en severity `critical`, avec le
 * rang d'entrée et la preuve chiffrée dans le payload. Non fatal : un audit ne
 * doit jamais échouer parce que l'écriture du workbench a échoué.
 */
export async function writeGatesToWorkbench(
  sb: any,
  gates: AuditGate[],
  opts: { domain: string; url?: string | null; userId: string; trackedSiteId?: string | null },
): Promise<{ attempted: number; written: number }> {
  try {
    if (!sb || !opts?.userId || !opts?.domain || !Array.isArray(gates) || gates.length === 0) {
      return { attempted: 0, written: 0 };
    }
    // Les axes « estimated » et « total » décrivent la fiabilité de la mesure,
    // pas un défaut corrigible : ils restent dans le rapport, hors workbench.
    const actionable = gates.filter((g) => g.axis !== 'estimated' && g.axis !== 'total');
    if (actionable.length === 0) return { attempted: 0, written: 0 };

    const scopeKey = opts.url ? new URL(opts.url).pathname.replace(/\/+$/, '') || '/' : '*';
    const measuredAt = new Date().toISOString();
    let written = 0;
    for (const g of actionable) {
      const recordId = `gate_${opts.domain}_${scopeKey}_${g.source}_${g.axis}`;
      const row = {
        domain: opts.domain,
        tracked_site_id: opts.trackedSiteId || null,
        user_id: opts.userId,
        source_type: 'audit_strategic',
        source_function: 'audit-gates',
        source_record_id: recordId,
        finding_category: AXIS_CATEGORY[g.axis] || 'geo_visibility',
        severity: 'critical',
        title: `Cause racine — ${gateAxisLabel(g.axis)}`.slice(0, 280),
        description: `${g.reason}${g.evidence ? ` — ${g.evidence}` : ''}`.slice(0, 2000),
        target_url: opts.url || null,
        payload: {
          gate_axis: g.axis,
          gate_source: g.source,
          gate_rank: g.rank,
          evidence: g.evidence || null,
          measured: g.measured ?? null,
          target: g.target ?? null,
          // Horodatage de la mesure : c'est lui qui permet d'écarter une valeur
          // périmée au moment de construire le plan consolidé.
          measured_at: measuredAt,
        },
      };
      try {
        const { error } = await sb
          .from('architect_workbench')
          .upsert(row, { onConflict: 'source_type,source_record_id' });
        if (!error) written++;
        else console.warn(`[auditGates] upsert failed (${row.source_record_id}): ${error.message}`);
        // Purge des doublons d'un même axe sur une même URL : un run antérieur
        // (ou un autre moteur) avait pu écrire le même plafond sous une autre
        // clé de portée, avec une valeur mesurée différente. Le plan consolidé
        // affichait alors deux LCP contradictoires pour la même page.
        if (!error) {
          try {
            let del = sb
              .from('architect_workbench')
              .delete()
              .eq('domain', opts.domain)
              .eq('source_function', 'audit-gates')
              .eq('payload->>gate_axis', g.axis)
              .neq('source_record_id', recordId);
            del = opts.url ? del.eq('target_url', opts.url) : del.is('target_url', null);
            const { error: delErr } = await del;
            if (delErr) console.warn(`[auditGates] purge doublons échouée (${g.axis}): ${delErr.message}`);
          } catch (pe) {
            console.warn('[auditGates] purge exception:', pe);
          }
        }
      } catch (e) {
        console.warn('[auditGates] upsert exception:', e);
      }
    }

    console.log(`[auditGates] ${written}/${actionable.length} gate(s) poussés en tête de workbench (${opts.domain})`);
    return { attempted: actionable.length, written };
  } catch (e) {
    console.warn('[auditGates] fatal guard:', e);
    return { attempted: 0, written: 0 };
  }
}

/**
 * Tri d'entrée du workbench : les gates (cause racine) passent devant, puis la
 * sévérité, puis l'ordre d'origine. Utilisé au moment de lire le workbench pour
 * construire le plan consolidé.
 */
export function sortWorkbenchByGatePriority<T extends { source_function?: string | null; severity?: string | null; payload?: any }>(
  tasks: T[],
): T[] {
  const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...(tasks || [])].sort((a, b) => {
    const ga = a?.source_function === 'audit-gates' ? 0 : 1;
    const gb = b?.source_function === 'audit-gates' ? 0 : 1;
    if (ga !== gb) return ga - gb;
    if (ga === 0) {
      const ra = Number(a?.payload?.gate_rank ?? 99);
      const rb = Number(b?.payload?.gate_rank ?? 99);
      if (ra !== rb) return ra - rb;
    }
    return (sevRank[String(a?.severity)] ?? 9) - (sevRank[String(b?.severity)] ?? 9);
  });
}
