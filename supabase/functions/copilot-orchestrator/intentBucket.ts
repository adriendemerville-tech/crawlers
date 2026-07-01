/**
 * intentBucket.ts — Classification post-hoc du tour utilisateur (Sprint 1 S1.4).
 *
 * Objectif : logger `intent_bucket` sur chaque _assistant_reply pour valider
 * la distribution des intents avant de décider Go/No-Go S2 (intent router).
 *
 * Buckets :
 *   - chit_chat        : salut, remerciement, question ouverte non-actionable
 *   - navigate         : demande de navigation UI (navigate_to, open_audit_panel)
 *   - read_skill       : lecture data (read_*, audit_internal_mesh, list_*, market_diagnosis)
 *   - write_skill      : action mutante (cms_*, trigger_*, refresh_*, escalate_*, propose_*, write_*)
 *   - complex_reasoning: >2 tool_calls OU >2 itérations LLM OU écriture ET lecture combinées
 *
 * NB : purement post-hoc, aucun LLM appelé. Régex + heuristiques légères.
 *      Utilisé UNIQUEMENT pour la télémétrie, jamais pour router en S1.
 */

export type IntentBucket =
  | 'chit_chat'
  | 'navigate'
  | 'read_skill'
  | 'write_skill'
  | 'complex_reasoning';

const CHIT_CHAT_RE = /^\s*(bonjour|salut|hello|hi|coucou|merci|thanks|ok|d'accord|super|génial|au revoir|bye|à\s+plus|à\s+bient[oô]t)\b.{0,80}[.!?]?\s*$/i;

const NAVIGATE_SKILLS = new Set([
  'navigate_to',
  'open_audit_panel',
]);

const READ_SKILL_PREFIXES = ['read_', 'list_', 'audit_', 'market_'];

const WRITE_SKILL_PREFIXES = [
  'cms_',
  'trigger_',
  'refresh_',
  'write_',
  'propose_',
  'escalate_',
  'deploy_',
  'plan_',
  'analyze_',
];

interface ExecutedAction { skill: string; status: string }

export function classifyIntentBucket(args: {
  userMessage: string;
  executedActions: ExecutedAction[];
  iterations: number;
}): IntentBucket {
  const { userMessage, executedActions, iterations } = args;

  // Filtre les actions "system" (_user_message, _assistant_reply, _assistant_intermediate)
  const skillsExecuted = executedActions
    .map((a) => a.skill)
    .filter((s) => !s.startsWith('_'));

  const uniqueSkills = new Set(skillsExecuted);

  // 1) Chit-chat : aucune skill + message court/salutations
  if (skillsExecuted.length === 0) {
    if (CHIT_CHAT_RE.test(userMessage) || userMessage.trim().length < 30) {
      return 'chit_chat';
    }
    // Pas de skill mais message long = LLM a répondu directement (Q/R contextuelle)
    // → considéré chit_chat pour les besoins de routing (répondable par Gemini Lite en S2)
    return 'chit_chat';
  }

  // 2) Complex reasoning : plusieurs skills OU boucle >2 itérations OU mix R/W
  const hasWrite = skillsExecuted.some((s) => WRITE_SKILL_PREFIXES.some((p) => s.startsWith(p)));
  const hasRead = skillsExecuted.some((s) => READ_SKILL_PREFIXES.some((p) => s.startsWith(p)));
  if (uniqueSkills.size > 2 || iterations > 2 || (hasWrite && hasRead)) {
    return 'complex_reasoning';
  }

  // 3) Navigate : uniquement des skills de navigation
  if (skillsExecuted.every((s) => NAVIGATE_SKILLS.has(s))) {
    return 'navigate';
  }

  // 4) Write vs Read
  if (hasWrite) return 'write_skill';
  return 'read_skill';
}

/**
 * Détecte si le message user justifie un rappel mémoire (recall vectoriel).
 * Sprint 1 S1.3 — évite l'embed+RPC pour chit-chat/navigate purs.
 *
 * Déclencheurs :
 *   - Pronom référentiel (ça, celui-ci, cette, précédemment, tout à l'heure…)
 *   - Mot-clé mémoire explicite (rappelle-toi, souviens-toi, on avait dit…)
 *   - Question longue (>60 chars) — probablement contextuelle
 *   - Contient une entité métier (audit, cocoon, article, page, site…) — peut bénéficier d'historique
 */
const RECALL_TRIGGERS_RE = new RegExp(
  [
    // Pronoms référentiels FR
    "\\b(ça|celui[- ]ci|celle[- ]ci|celui[- ]l[àa]|celle[- ]l[àa]|ceux[- ]ci|celles[- ]ci|cela|c'est|c'était)\\b",
    // Références temporelles
    "\\b(pr[ée]c[ée]demment|avant|tout ?[àa] ?l['e ]?heure|tantôt|hier|dernière fois|l'autre fois|d[ée]j[àa])\\b",
    // Mémoire explicite
    "\\b(rappelle[- ]toi|souviens[- ]toi|on avait dit|tu m'avais dit|comme convenu|comme discuté)\\b",
    // Entités métier
    "\\b(audit|cocoon|article|page|site|maillage|refonte|persona|parménion|parmenion|felix|félix|stratège|strategist)\\b",
  ].join('|'),
  'i',
);

export function shouldRecallMemory(userMessage: string): boolean {
  if (!userMessage) return false;
  const trimmed = userMessage.trim();
  if (trimmed.length < 8) return false;
  if (trimmed.length > 60) return true;
  return RECALL_TRIGGERS_RE.test(trimmed);
}

/**
 * Sprint 1 S1.5 — pré-classification légère (avant tout appel LLM) pour
 * ajuster `maxOutputTokens`. Purement heuristique regex, ~0 ms.
 * Peut différer du post-hoc si le LLM appelle finalement des skills ;
 * n'est utilisé que pour dimensionner la fenêtre de sortie.
 */
export function preClassifyIntent(userMessage: string): IntentBucket {
  const trimmed = (userMessage ?? '').trim();
  if (trimmed.length === 0) return 'chit_chat';
  if (CHIT_CHAT_RE.test(trimmed) || trimmed.length < 25) return 'chit_chat';
  if (/\b(publie|publier|d[ée]ploie|d[ée]ployer|cr[ée]e|cr[ée]er|met[s]?[- ]?[àa][- ]?jour|modifie|supprime|lance|d[ée]clenche|refresh|patch|push|corrige)\b/i.test(trimmed)) {
    return 'write_skill';
  }
  if (/\b(va[- ]y|ouvre|montre[- ]moi|affiche|emm[èe]ne[- ]moi|onglet)\b/i.test(trimmed) && trimmed.length < 100) {
    return 'navigate';
  }
  if (trimmed.length > 200 || /\b(pourquoi|comment|explique|analyse|compare|d[ée]taille|audite?)\b/i.test(trimmed)) {
    return 'complex_reasoning';
  }
  return 'read_skill';
}

/** Sprint 1 S1.5 — mapping bucket → maxOutputTokens. */
export function maxTokensForBucket(bucket: IntentBucket, personaDefault: number): number {
  switch (bucket) {
    case 'chit_chat': return Math.min(200, personaDefault);
    case 'navigate': return Math.min(250, personaDefault);
    case 'read_skill': return Math.min(500, personaDefault);
    case 'write_skill': return Math.min(600, personaDefault);
    case 'complex_reasoning': return personaDefault;
  }
}
