import { useMemo, useEffect } from 'react';
import { ExpertAuditResult } from '@/types/expertAudit';
import { buildChartData } from '../AuditRadialChart';

const STORAGE_KEY_PREFIX = 'crawlers_prev_audit_';

type ChartItem = { name: string; value: number; raw: number; max: number };

/**
 * Hook that loads the previous audit chart data from localStorage,
 * and saves the current one for next time.
 */
export function usePreviousAuditData(
  result: ExpertAuditResult | null,
  mode: 'technical' | 'strategic',
  language: string
): ChartItem[] | null {
  const labels: Record<string, string> = useMemo(() => {
    const map: Record<string, Record<string, string>> = {
      fr: { performance: 'Performance', technical: 'Technique', semantic: 'Contenu', aiReady: 'IA & GEO', security: 'Sécurité', citability: 'Citabilité', brand: 'Marque', social: 'Social', market: 'Marché', geoReady: 'GEO Ready', keywords: 'Mots-clés', title: 'Score de qualité' },
      en: { performance: 'Performance', technical: 'Technical', semantic: 'Content', aiReady: 'AI & GEO', security: 'Security', citability: 'Citability', brand: 'Brand', social: 'Social', market: 'Market', geoReady: 'GEO Ready', keywords: 'Keywords', title: 'Quality Score' },
      es: { performance: 'Rendimiento', technical: 'Técnico', semantic: 'Contenido', aiReady: 'IA & GEO', security: 'Seguridad', citability: 'Citabilidad', brand: 'Marca', social: 'Social', market: 'Mercado', geoReady: 'GEO Ready', keywords: 'Palabras clave', title: 'Puntuación de calidad' },
    };
    return map[language] || map.fr;
  }, [language]);

  const domain = result?.domain || '';
  const storageKey = `${STORAGE_KEY_PREFIX}${domain}_${mode}`;

  // Load previous data
  const previousData = useMemo<ChartItem[] | null>(() => {
    if (!domain) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* ignore */ }
    return null;
  }, [storageKey, domain]);

  // Save current data for next time (after render)
  useEffect(() => {
    if (!result || !domain) return;
    try {
      const { data } = buildChartData(result, mode, labels);
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch { /* ignore */ }
  }, [result, mode, labels, storageKey, domain]);

  return previousData;
}
