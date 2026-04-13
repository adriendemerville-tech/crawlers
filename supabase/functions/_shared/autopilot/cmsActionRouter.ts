/**
 * autopilot/cmsActionRouter.ts — Categorizes CMS actions as 'content' or 'code'.
 * Extracted from autopilot-engine monolith.
 */

import type { RoutedActions } from './types.ts';

const CONTENT_FIELDS = new Set([
  'body', 'content', 'title', 'excerpt', 'heading', 'h1', 'h2', 'paragraphs', 'faq', 'summary',
]);

const CODE_FIELDS = new Set([
  'meta_title', 'meta_description', 'canonical_url', 'schema_org', 'json_ld',
  'og_title', 'og_description', 'og_image', 'robots', 'hreflang',
]);

export function classifyAction(action: Record<string, unknown>): 'content' | 'code' | 'both' {
  const actionName = (action.action as string) || '';
  
  if (actionName.startsWith('create-') || actionName.startsWith('delete-')) return 'both';

  const updates = (action.updates || action.body || {}) as Record<string, unknown>;
  const fields = Object.keys(updates);
  
  const hasContent = fields.some(f => CONTENT_FIELDS.has(f));
  const hasCode = fields.some(f => CODE_FIELDS.has(f));
  
  if (hasContent && hasCode) return 'both';
  if (hasCode) return 'code';
  if (hasContent) return 'content';
  
  if (actionName.includes('post') || actionName.includes('page')) return 'content';
  return 'both';
}

export function routeCmsActions(actions: Array<Record<string, unknown>>, domain: string): RoutedActions {
  const content: Array<Record<string, unknown>> = [];
  const code: Array<Record<string, unknown>> = [];
  const all: Array<Record<string, unknown>> = [];

  for (const action of actions) {
    const channel = classifyAction(action);
    const taggedAction = { ...action, _channel: channel };
    all.push(taggedAction);
    
    if (channel === 'content' || channel === 'both') content.push(taggedAction);
    if (channel === 'code' || channel === 'both') code.push(taggedAction);
  }

  console.log(`[CMS Router] ${domain}: ${content.length} content, ${code.length} code, ${all.length} total actions`);
  return { content, code, all };
}
