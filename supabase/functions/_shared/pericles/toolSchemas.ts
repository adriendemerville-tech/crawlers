/**
 * parmenion/toolSchemas.ts — LLM tool definitions for Prescribe V2 dual-prompt engine.
 * Extracted from parmenion-orchestrator monolith.
 */

export const TECH_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'emit_code',
      description: 'Emit injectable JS code fix (lazy loading, CLS, performance, etc.)',
      parameters: {
        type: 'object',
        properties: {
          fix_id: { type: 'string' },
          label: { type: 'string', description: 'Short human-readable description' },
          category: { type: 'string', enum: ['performance', 'seo', 'accessibility', 'security'] },
          prompt: { type: 'string', description: 'Detailed instructions for JS code generation' },
          target_url: { type: 'string' },
          target_selector: { type: 'string', description: 'CSS selector or DOM element to target' },
        },
        required: ['fix_id', 'label', 'category', 'prompt'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'emit_corrective_data',
      description: 'Emit corrective metadata: meta_description, canonical, schema_org, robots, JSON-LD',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['update-page', 'update-post'] },
          page_key: { type: 'string', description: 'Page slug or identifier' },
          slug: { type: 'string', description: 'Post slug (for update-post)' },
          field: { type: 'string', enum: ['meta_description', 'meta_title', 'canonical_url', 'schema_org', 'robots'] },
          value: { type: 'string', description: 'New value for the field' },
          schema_org_value: { type: 'object', description: 'JSON-LD object (when field=schema_org)' },
        },
        required: ['action', 'field', 'value'],
      },
    },
  },
];

export const CONTENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'emit_corrective_content',
      description: 'Emit corrective content for an existing page: fix H1, H2, enrich paragraphs, add FAQ, etc.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['update-page', 'update-post'] },
          page_key: { type: 'string' },
          slug: { type: 'string' },
          updates: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string', description: 'Markdown content to replace/append' },
              excerpt: { type: 'string' },
            },
          },
          target_selector: { type: 'string', description: 'Which section to update (e.g. h1, h2#section, content)' },
          operation: { type: 'string', enum: ['replace', 'append', 'insert_after'] },
        },
        required: ['action', 'updates'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'emit_editorial_content',
      description: 'Create a new article or page from scratch to fill a content gap',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create-post', 'create-page'] },
          body: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              slug: { type: 'string' },
              content: { type: 'string', description: 'Full Markdown content with ## H2, ### H3, lists, internal links [ancre](url). MINIMUM 800 mots (environ 5000 caractères). Un article de qualité fait entre 800 et 1500 mots. Ne JAMAIS produire moins de 600 mots.', minLength: 3000 },
              excerpt: { type: 'string' },
              meta_description: { type: 'string' },
              meta_title: { type: 'string' },
              status: { type: 'string', enum: ['draft'] },
              author_name: { type: 'string' },
              category: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              schema_org: { type: 'object' },
              article_type: { type: 'string', enum: ['presentation', 'actualite', 'comparatif', 'tutoriel', 'opinion', 'guide'], description: 'Type d\'article selon la taxonomie éditoriale. OBLIGATOIRE.' },
              semantic_ring: { type: 'integer', enum: [1, 2, 3], description: 'Anneau sémantique: 1=cœur de cible, 2=second cercle, 3=expansion large' },
            },
            required: ['title', 'slug', 'content', 'excerpt', 'meta_description', 'status', 'article_type', 'semantic_ring'],
          },
        },
        required: ['action', 'body'],
      },
    },
  },
];

/** Decision tool schema for non-prescribe phases */
export const DECISION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'parmenion_decide',
    description: 'Submit Parménion autonomous action for this autopilot cycle',
    parameters: {
      type: 'object',
      properties: {
        goal: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['audit_technical', 'diagnostic_semantic', 'cluster_optimization', 'content_gap', 'content_creation', 'linking', 'technical_fix', 'deployment', 'meta_optimization', 'validation_post_deploy'] },
            cluster_id: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['type', 'description'],
        },
        tactic: {
          type: 'object',
          properties: {
            initial_scope: { type: 'object' },
            final_scope: { type: 'object' },
            scope_reductions: { type: 'integer' },
            estimated_tokens: { type: 'integer' },
            target_url: { type: 'string' },
          },
          required: ['initial_scope', 'final_scope', 'scope_reductions', 'estimated_tokens'],
        },
        prudence: {
          type: 'object',
          properties: {
            impact_level: { type: 'string', enum: ['faible', 'modéré', 'neutre', 'avancé', 'très_avancé'] },
            risk_score: { type: 'integer', minimum: 1, maximum: 3 },
            iterations: { type: 'integer' },
            goal_changed: { type: 'boolean' },
            reasoning: { type: 'string' },
          },
          required: ['impact_level', 'risk_score', 'iterations', 'goal_changed', 'reasoning'],
        },
        action: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            payload: { type: 'object' },
            functions: { type: 'array', items: { type: 'string' } },
          },
          required: ['type', 'payload', 'functions'],
        },
        summary: { type: 'string' },
      },
      required: ['goal', 'tactic', 'prudence', 'action', 'summary'],
      additionalProperties: false,
    },
  },
};
