/**
 * Autonomy Score computation.
 *
 * Formula: score = (persona_base * 4) + (seo_knowledge * 3) + (autonomy_self * 3)
 * Max = 10*4 + 5*3 + 5*3 = 40+15+15 = 70  → normalised to 0-100
 *
 * Levels:
 *   0-35  → beginner    (accompagnement maximal, langage vulgarisé, messages longs)
 *   36-65 → intermediate (équilibré)
 *   66-100→ expert       (concis, jargon SEO, données brutes)
 */

export type AutonomyLevel = 'beginner' | 'intermediate' | 'expert';

/** Default base scores per persona */
const PERSONA_BASE: Record<string, number> = {
  entrepreneur: 2,
  marketing: 4,
  freelance: 6,
  agency: 7,
  ecommerce: 3,
  media: 5,
  developer: 5,
};

export interface AutonomyRaw {
  persona_base: number;
  seo_knowledge: number;   // 1-5
  autonomy_self: number;   // 1-5
  persona_type: string | null;
  computed_at: string;
}

export interface AutonomyResult {
  score: number;           // 0-100
  level: AutonomyLevel;
  raw: AutonomyRaw;
}

export function getPersonaBase(persona: string | null): number {
  if (!persona) return 3; // default middle
  return PERSONA_BASE[persona] ?? 3;
}

export function computeAutonomyScore(
  persona: string | null,
  seoKnowledge: number,   // 1-5
  autonomySelf: number,   // 1-5
): AutonomyResult {
  const personaBase = getPersonaBase(persona);

  // Weighted sum → max 70
  const rawScore = (personaBase * 4) + (seoKnowledge * 3) + (autonomySelf * 3);
  const score = Math.round((rawScore / 70) * 100);
  const clampedScore = Math.max(0, Math.min(100, score));

  let level: AutonomyLevel;
  if (clampedScore <= 35) level = 'beginner';
  else if (clampedScore <= 65) level = 'intermediate';
  else level = 'expert';

  return {
    score: clampedScore,
    level,
    raw: {
      persona_base: personaBase,
      seo_knowledge: seoKnowledge,
      autonomy_self: autonomySelf,
      persona_type: persona,
      computed_at: new Date().toISOString(),
    },
  };
}

/** Prompt behaviour hints based on autonomy level */
export function getAutonomyHints(level: AutonomyLevel) {
  switch (level) {
    case 'beginner':
      return {
        tone: 'pédagogique et encourageant',
        jargon: false,
        verbosity: 'détaillé avec exemples concrets',
        maxTokensHint: 600,
        proactive: true,
      };
    case 'intermediate':
      return {
        tone: 'professionnel et clair',
        jargon: true,
        verbosity: 'équilibré',
        maxTokensHint: 400,
        proactive: true,
      };
    case 'expert':
      return {
        tone: 'concis et technique',
        jargon: true,
        verbosity: 'synthétique, données brutes privilégiées',
        maxTokensHint: 250,
        proactive: false,
      };
  }
}
