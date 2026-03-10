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
  const sanitizedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    // Force all links to open in new tab
    .replace(/<a\s+(?![^>]*target=)/gi, '<a target="_blank" rel="noopener noreferrer" ')
    .replace(/<a\s+([^>]*?)(?<!target=["'][^"']*["'])>/gi, (match) => {
      if (match.includes('target=')) return match;
      return match.replace('<a ', '<a target="_blank" rel="noopener noreferrer" ');
    });

  return (
    <div 
      className={`html-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

export const HtmlContentRenderer = memo(HtmlContentRendererComponent);
