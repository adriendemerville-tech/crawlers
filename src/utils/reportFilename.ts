import { format } from 'date-fns';

type AuditType = 'auditstrategique' | 'audittechnique' | 'crawl' | 'compare' | 'maillage' | 'geo' | 'llm' | 'pagespeed' | 'matrice' | 'lexique' | 'backend-doc';

/**
 * Generate standardized report filename: domain_audittype_YYYY-MM-DD.ext
 */
export function getReportFilename(urlOrDomain: string, auditType: AuditType, extension: 'pdf' | 'csv' | 'html' | 'xml' = 'pdf'): string {
  const domain = extractDomain(urlOrDomain);
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  return `${domain}_${auditType}_${dateStr}.${extension}`;
}

function extractDomain(urlOrDomain: string): string {
  try {
    const withProtocol = urlOrDomain.startsWith('http') ? urlOrDomain : `https://${urlOrDomain}`;
    return new URL(withProtocol).hostname.replace(/^www\./, '').replace(/[^a-zA-Z0-9.-]/g, '_');
  } catch {
    return urlOrDomain.replace(/[^a-zA-Z0-9.-]/g, '_') || 'report';
  }
}
