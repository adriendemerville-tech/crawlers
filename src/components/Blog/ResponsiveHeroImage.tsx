import { memo } from 'react';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface ResponsiveHeroImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Génère un srcset optimisé pour les images Unsplash
 * Réduit la taille de téléchargement en servant des images adaptées au viewport
 */
function generateSrcSet(src: string): string | undefined {
  // Unsplash URLs can be optimized with width parameter
  if (src.includes('unsplash.com')) {
    const baseUrl = src.replace(/[?&]w=\d+/, '').replace(/[?&]q=\d+/, '');
    const separator = baseUrl.includes('?') ? '&' : '?';
    
    return [
      `${baseUrl}${separator}w=640&q=75&auto=format 640w`,
      `${baseUrl}${separator}w=828&q=75&auto=format 828w`,
      `${baseUrl}${separator}w=1200&q=80&auto=format 1200w`,
      `${baseUrl}${separator}w=1920&q=80&auto=format 1920w`,
    ].join(', ');
  }
  
  return undefined;
}

/**
 * Génère les sizes pour le responsive
 */
function getSizes(): string {
  return '100vw';
}

/**
 * Optimise l'URL source pour la taille par défaut
 */
function getOptimizedSrc(src: string): string {
  if (src.includes('unsplash.com')) {
    // Pour les écrans standards, 1200px est suffisant
    const baseUrl = src.replace(/[?&]w=\d+/, '').replace(/[?&]q=\d+/, '');
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}w=1200&q=80&auto=format`;
  }
  return src;
}

function ResponsiveHeroImageComponent({
  src,
  alt,
  className = '',
}: ResponsiveHeroImageProps) {
  const srcSet = generateSrcSet(src);
  const sizes = getSizes();
  const optimizedSrc = getOptimizedSrc(src);
  const isLocalAsset = src.startsWith('/') || src.includes('/assets/');

  return (
    <img
      src={isLocalAsset ? src : optimizedSrc}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={1200}
      height={630}
      className={`w-full h-full object-cover ${className}`}
      loading="eager"
      fetchPriority="high"
      decoding="async"
    />
  );
}

export const ResponsiveHeroImage = memo(ResponsiveHeroImageComponent);
