import { memo } from 'react';

interface HtmlContentRendererProps {
  html: string;
  className?: string;
}

/**
 * Composant pour afficher du contenu HTML stocké en base de données
 * Utilisé pour les articles de blog éditables depuis l'admin
 */
function HtmlContentRendererComponent({ html, className = '' }: HtmlContentRendererProps) {
  // Nettoyer le HTML pour la sécurité basique
  // Note: Pour une sécurité renforcée, utiliser DOMPurify en production
  const sanitizedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');

  return (
    <div 
      className={`html-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

export const HtmlContentRenderer = memo(HtmlContentRendererComponent);
