/**
 * normalizeDocxToMatrix — Transforms raw DOCX text into structured criteria
 * using a lightweight LLM call (Gemini Flash Lite).
 */

import { supabase } from '@/integrations/supabase/client';

export interface NormalizedCriterion {
  id: string;
  title: string;
  category: string;
  description?: string;
  weight?: number;
}

export async function normalizeDocxToMatrix(rawText: string): Promise<NormalizedCriterion[]> {
  const { data, error } = await supabase.functions.invoke('audit-matrice', {
    body: {
      action: 'normalize-docx',
      rawText: rawText.slice(0, 15000), // Limit to ~15k chars for cost
    },
  });

  if (error || !data?.criteria) {
    console.error('[normalizeDocxToMatrix] Error:', error);
    // Fallback: try to extract lines as criteria
    return fallbackExtract(rawText);
  }

  return (data.criteria as any[]).map((c: any, i: number) => ({
    id: `docx-${i + 1}`,
    title: c.title || `Critère ${i + 1}`,
    category: c.category || 'general',
    description: c.description,
    weight: c.weight,
  }));
}

function fallbackExtract(text: string): NormalizedCriterion[] {
  const lines = text
    .split(/\n/)
    .map(l => l.trim())
    .filter(l => l.length > 10 && l.length < 200)
    .filter(l => !l.startsWith('http') && !l.startsWith('/'))
    .filter(l => !/^\d{4}-\d{2}/.test(l)) // No dates
    .slice(0, 50);

  return lines.map((line, i) => ({
    id: `docx-fallback-${i + 1}`,
    title: line.replace(/^[\d\.\-\)\]\s]+/, '').trim(),
    category: 'general',
  }));
}
