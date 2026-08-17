/**
 * aeoRewrites.ts — Prescriptions de réécriture « réponse directe ».
 *
 * Objectif : transformer un paragraphe qui *parle* du sujet en un paragraphe qui
 * *donne la réponse* de façon extractible (featured snippet, People Also Ask,
 * Google Overview, citation LLM). Volontairement SANS score dédié ni section
 * dédiée dans les rapports : la prescription part directement dans
 * `architect_workbench` (catégorie existante `rewrite_content`), donc elle est
 * consommée par Parménion (phase prescribe) et le Stratège cocoon comme
 * n'importe quel autre constat.
 *
 * 100 % déterministe, 0 token LLM :
 *   - la question cible est dérivée du H1 / titre / intention de page ;
 *   - le paragraphe à réécrire est celui qui devrait porter la réponse
 *     (premier paragraphe substantiel, ou le plus long des trois premiers) ;
 *   - l'exemple concret de réécriture (~40 mots) est construit à partir des
 *     phrases les plus informatives du paragraphe existant, jamais inventé.
 *
 * Idempotent : source_record_id = `aeo_rewrite_<hash(url)>` → un nouveau passage
 * met à jour la même ligne. Échec toujours non bloquant.
 */

import { buildBoilerplateSet, stripBoilerplate } from './contentIntegrity/normalize.ts';

export interface AeoPageInput {
  url: string;
  title?: string | null;
  h1?: string | null;
  text?: string | null;            // body_text_truncated ou texte extrait
  page_intent?: string | null;
  word_count?: number | null;
  archetype_key?: string | null;
  archetype_label?: string | null;
}

export interface AeoRewrite {
  url: string;
  question: string;
  currentParagraph: string;        // extrait réel de la page
  currentWords: number;
  suggestedAnswer: string;         // exemple concret, ~40 mots
  answerWords: number;
  reason: string;
  archetypeKey?: string | null;
  archetypeLabel?: string | null;
}

const MIN_PARAGRAPH_WORDS = 25;
const TARGET_ANSWER_WORDS = 40;

function words(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitParagraphs(text: string): string[] {
  const byBlank = cleanText(text).split(/\n\s*\n/);
  const parts = byBlank.length > 1 ? byBlank : cleanText(text).split(/\n/);
  return parts.map((p) => p.trim()).filter((p) => words(p).length >= 8);
}

function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Retire le suffixe de marque (« … | Marque »), sans casser les traits d'union internes. */
function cleanSubject(page: AeoPageInput): string {
  return (page.h1 || page.title || '')
    .replace(/\s+[|·»]\s*.{2,40}$/, '')
    .replace(/\s+[–—]\s+.{2,40}$/, '')
    .replace(/\s-\s.{2,40}$/, '')
    .trim();
}

/** Question cible : on part du H1 (l'intention réelle de la page), pas du titre SEO. */
function deriveQuestion(page: AeoPageInput): string {
  const base = cleanSubject(page);

  if (!base) return 'Quelle est la réponse que cette page doit donner en premier ?';
  if (/\?$/.test(base)) return base;
  const intent = (page.page_intent || '').toLowerCase();
  if (intent === 'buy') return `Pourquoi choisir ${base} et à quel prix ?`;
  if (intent === 'do') return `Comment faire : ${base} ?`;
  if (intent === 'navigate') return `Que trouve-t-on sur « ${base} » ?`;
  return `${base} : de quoi s'agit-il exactement ?`;
}

/** Le paragraphe qui devrait porter la réponse : premier substantiel, sinon le plus long des 3 premiers. */
function pickParagraph(paragraphs: string[]): string | null {
  const head = paragraphs.slice(0, 3);
  const substantial = head.filter((p) => words(p).length >= MIN_PARAGRAPH_WORDS);
  if (substantial.length) {
    return substantial.reduce((a, b) => (words(b).length > words(a).length ? b : a));
  }
  return head[0] || null;
}

/**
 * Exemple concret de réécriture : phrases les plus informatives du paragraphe
 * existant (chiffres, verbes d'action, entités), condensées à ~40 mots et
 * amorcées par une formulation auto-suffisante.
 */
function buildAnswer(question: string, paragraph: string, page: AeoPageInput): string {
  const subject = cleanSubject(page);
  const sentences = splitSentences(paragraph);
  const scored = sentences
    .map((s) => {
      let score = 0;
      if (/\d/.test(s)) score += 3;
      if (/\b(permet|propose|offre|inclut|couvre|intervient|réalise|installe|livre|forme|accompagne|analyse|détecte)\b/i.test(s)) score += 2;
      if (subject && s.toLowerCase().includes(subject.toLowerCase().split(/\s+/)[0] || '')) score += 1;
      const w = words(s).length;
      if (w >= 8 && w <= 35) score += 1;
      // Une incitation seule n'apporte aucune information extractible.
      if (/^(contactez|appelez|demandez|remplissez|cliquez|découvrez)\b/i.test(s.trim()) && w <= 8) score -= 4;
      return { s, score };
    })

    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);


  const lead = subject ? `${subject} :` : '';
  const bodyParts: string[] = [];
  let count = words(lead).length;
  for (const s of scored) {
    const w = words(s).length;
    if (count + w > TARGET_ANSWER_WORDS + 6) continue;
    bodyParts.push(s);
    count += w;
    if (count >= TARGET_ANSWER_WORDS - 8) break;
  }
  if (!bodyParts.length && sentences.length) bodyParts.push(sentences[0]);

  let answer = [lead, bodyParts.join(' ')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const aw = words(answer);
  if (aw.length > TARGET_ANSWER_WORDS + 8) {
    answer = aw.slice(0, TARGET_ANSWER_WORDS + 5).join(' ').replace(/[,;:]$/, '') + '.';
  }
  return answer;
}

/** Une prescription pour une page donnée, ou null si le texte est trop pauvre pour être exploitable. */
export function buildAeoRewrite(page: AeoPageInput): AeoRewrite | null {
  if (!page?.url || !page.text) return null;
  const paragraphs = splitParagraphs(page.text);
  if (!paragraphs.length) return null;
  const paragraph = pickParagraph(paragraphs);
  if (!paragraph) return null;

  const pw = words(paragraph).length;
  const question = deriveQuestion(page);
  const answersAlready = pw <= 55 && /^(?:[A-ZÉÀÂÎÔÛÇ][^.!?]{10,})[.!?]/.test(paragraph) && /\d|\b(est|sont|permet|coûte|dure|signifie)\b/i.test(splitSentences(paragraph)[0] || '');

  // Page qui ouvre déjà par une réponse courte et auto-suffisante : rien à prescrire.
  if (answersAlready && pw <= 45) return null;

  const reason = pw > 70
    ? `Le premier paragraphe fait ${pw} mots et noie la réponse : aucun moteur ne peut en extraire un passage autonome.`
    : pw < MIN_PARAGRAPH_WORDS
      ? `Le paragraphe d'ouverture est trop maigre (${pw} mots) pour constituer une réponse autonome citable.`
      : `Le paragraphe d'ouverture (${pw} mots) contextualise au lieu de répondre : la réponse arrive trop tard pour être extraite.`;

  const suggestedAnswer = buildAnswer(question, paragraph, page);
  if (!suggestedAnswer || words(suggestedAnswer).length < 12) return null;

  return {
    url: page.url,
    question,
    currentParagraph: paragraph.slice(0, 700),
    currentWords: pw,
    suggestedAnswer,
    answerWords: words(suggestedAnswer).length,
    reason,
    archetypeKey: page.archetype_key || null,
    archetypeLabel: page.archetype_label || null,
  };
}

/**
 * Sélection sur un crawl multipage : une prescription par gabarit (ou par
 * répertoire de premier niveau à défaut), plafonnée. Sur un gros site on ne
 * répète pas 150 fois la même consigne : un exemple concret par type de page.
 */
export function buildAeoRewrites(pages: AeoPageInput[], maxItems = 6): AeoRewrite[] {
  const byBucket = new Map<string, AeoRewrite>();
  for (const p of pages || []) {
    if (!p?.url) continue;
    if ((p.word_count ?? 0) > 0 && (p.word_count as number) < 80) continue;
    const rewrite = buildAeoRewrite(p);
    if (!rewrite) continue;
    let bucket = p.archetype_key || '';
    if (!bucket) {
      try { bucket = new URL(p.url).pathname.split('/').filter(Boolean)[0] || 'racine'; }
      catch { bucket = 'racine'; }
    }
    const current = byBucket.get(bucket);
    // On garde le cas le plus pénalisant du gabarit (paragraphe le plus long).
    if (!current || rewrite.currentWords > current.currentWords) byBucket.set(bucket, rewrite);
  }
  return [...byBucket.values()]
    .sort((a, b) => b.currentWords - a.currentWords)
    .slice(0, maxItems);
}

interface WriteOptions {
  domain: string;
  userId: string;
  trackedSiteId?: string | null;
  sourceFunction: string;          // 'marina' | 'audit-strategique-ia'
  sourceType?: string;             // 'audit_strategic' (défaut) ou 'audit'
}

/** Pousse les réécritures dans architect_workbench. Non bloquant par construction. */
export async function writeAeoRewritePrescriptions(
  sb: any,
  rewrites: AeoRewrite[],
  opts: WriteOptions,
): Promise<{ attempted: number; written: number }> {
  try {
    if (!sb || !opts?.userId || !opts?.domain || opts.userId === 'service-role' || !rewrites?.length) {
      return { attempted: 0, written: 0 };
    }
    const domain = opts.domain.replace(/^www\./, '').toLowerCase();
    let written = 0;
    for (const r of rewrites) {
      const row = {
        domain,
        tracked_site_id: opts.trackedSiteId || null,
        user_id: opts.userId,
        source_type: opts.sourceType || 'audit_strategic',
        source_function: opts.sourceFunction,
        source_record_id: `aeo_rewrite_${shortHash(r.url)}_${domain}`,
        finding_category: 'rewrite_content',
        severity: r.currentWords > 90 ? 'high' : 'medium',
        status: 'pending',
        title: `Reformuler le paragraphe d'ouverture en réponse directe de ${TARGET_ANSWER_WORDS} mots${r.archetypeLabel ? ` — ${r.archetypeLabel}` : ''}`.slice(0, 280),
        description: [
          `${r.reason}`,
          `Question à laquelle la page doit répondre : « ${r.question} »`,
          `Paragraphe actuel (${r.currentWords} mots) : « ${r.currentParagraph.slice(0, 320)}${r.currentParagraph.length > 320 ? '…' : ''} »`,
          `Exemple concret de réécriture (${r.answerWords} mots, à placer juste sous le H1) : « ${r.suggestedAnswer} »`,
          `Consigne : réponse auto-suffisante en tête, une seule idée par phrase, chiffre ou délai vérifiable si disponible, le contexte descend dans le paragraphe suivant.`,
        ].join(' ').slice(0, 2000),
        target_url: r.url,
        payload: {
          auto_generated: true,
          origin: 'aeo_rewrite',
          question: r.question,
          current_paragraph: r.currentParagraph,
          current_words: r.currentWords,
          suggested_answer: r.suggestedAnswer,
          answer_words: r.answerWords,
          target_answer_words: TARGET_ANSWER_WORDS,
          archetype_key: r.archetypeKey,
          archetype_label: r.archetypeLabel,
        },
      };
      try {
        const { error } = await sb
          .from('architect_workbench')
          .upsert(row, { onConflict: 'source_type,source_record_id' });
        if (!error) written++;
        else console.warn(`[aeoRewrites] upsert failed (${row.source_record_id}): ${error.message}`);
      } catch (e) {
        console.warn('[aeoRewrites] upsert exception:', e);
      }
    }
    console.log(`[aeoRewrites] wrote ${written}/${rewrites.length} rewrite prescriptions for ${domain}`);
    return { attempted: rewrites.length, written };
  } catch (e) {
    console.warn('[aeoRewrites] fatal guard:', e);
    return { attempted: 0, written: 0 };
  }
}
