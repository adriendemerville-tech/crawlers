/**
 * personas.ts — Configuration par persona du Copilot.
 *
 * Un seul backend, plusieurs personnalités. Chaque persona définit :
 * - le system prompt à injecter (ré-utilise agentPersonas.ts existant)
 * - le modèle LLM à utiliser
 * - la liste blanche des skills accessibles
 * - la politique d'auto-exécution (auto / approval / forbidden)
 * - les limites de tokens / longueur
 */

import { FELIX_PERSONA, STRATEGIST_PERSONA } from '../_shared/agentPersonas.ts';

export type PersonaId = 'felix' | 'strategist';
export type SkillPolicy = 'auto' | 'approval' | 'forbidden';

export interface PersonaConfig {
  id: PersonaId;
  displayName: string;
  systemPrompt: string;
  model: string;
  maxOutputTokens: number;
  /** Map skill_name → policy. Skills absents = 'forbidden'. */
  skillPolicies: Record<string, SkillPolicy>;
  /** Default policy applied to skills not listed (sécurité par défaut). */
  defaultSkillPolicy: SkillPolicy;
}

// ─── FÉLIX — SAV, lecture, navigation ────────────────────────
export const FELIX_CONFIG: PersonaConfig = {
  id: 'felix',
  displayName: 'Félix',
  systemPrompt: FELIX_PERSONA.styleGuide,
  model: 'google/gemini-2.5-flash',
  maxOutputTokens: 800,
  skillPolicies: {
    // Lecture libre
    read_audit: 'auto',
    read_site_kpis: 'auto',
    read_user_profile: 'auto',
    read_documentation: 'auto',
    // Mémoire persistante & carte d'identité (Sprint Q5 — Bloc Mémoire & Identité)
    read_site_memory: 'auto',
    write_site_memory: 'auto',
    list_identity_suggestions: 'auto',
    propose_identity_suggestion: 'auto',
    // Live Search (Sprint Q5 Bloc 2 — quotas: free=3/conv, premium=5/conv, pro=20/jour)
    live_search: 'auto',
    // Escalade téléphone (Sprint Q5 Bloc 3 — approval obligatoire)
    escalate_to_phone: 'approval',
    // Navigation OK sans confirmation
    navigate_to: 'auto',
    open_audit_panel: 'auto',
    // Actions métier nécessitent approbation explicite
    trigger_audit: 'approval',
    refresh_kpis: 'approval',
    // Tout ce qui touche au CMS est interdit pour Félix
    cms_publish_draft: 'forbidden',
    cms_patch_content: 'forbidden',
  },
  defaultSkillPolicy: 'forbidden',
};

// ─── STRATÈGE COCOON — analyse, plan, déploiement CMS ────────
export const STRATEGIST_CONFIG: PersonaConfig = {
  id: 'strategist',
  displayName: 'Stratège Cocoon',
  systemPrompt: STRATEGIST_PERSONA.styleGuide,
  model: 'google/gemini-2.5-pro',
  maxOutputTokens: 1500,
  skillPolicies: {
    // Lecture étendue
    read_audit: 'auto',
    read_site_kpis: 'auto',
    read_cocoon_graph: 'auto',
    read_keyword_universe: 'auto',
    read_documentation: 'auto',
    // Mémoire persistante & carte d'identité (parité avec Félix)
    read_site_memory: 'auto',
    write_site_memory: 'auto',
    list_identity_suggestions: 'auto',
    propose_identity_suggestion: 'auto',
    // Live Search (parité Félix)
    live_search: 'auto',
    // Escalade téléphone (parité Félix — approval obligatoire)
    escalate_to_phone: 'approval',
    // Analyse / planification automatique
    analyze_cocoon: 'auto',
    plan_editorial: 'auto',
    // Navigation OK
    navigate_to: 'auto',
    open_audit_panel: 'auto',
    // Toutes les actions destructives passent par approbation
    trigger_audit: 'approval',
    cms_publish_draft: 'approval',
    cms_patch_content: 'approval',
    deploy_cocoon_plan: 'approval',
  },
  defaultSkillPolicy: 'forbidden',
};

const REGISTRY: Record<PersonaId, PersonaConfig> = {
  felix: FELIX_CONFIG,
  strategist: STRATEGIST_CONFIG,
};

export function getPersonaConfig(id: string): PersonaConfig | null {
  return REGISTRY[id as PersonaId] ?? null;
}

export function resolveSkillPolicy(persona: PersonaConfig, skill: string): SkillPolicy {
  return persona.skillPolicies[skill] ?? persona.defaultSkillPolicy;
}
