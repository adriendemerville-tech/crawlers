import { memo } from 'react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { buildImageSrcSet, buildImageUrl } from '@/lib/blog/imageUrl';

interface ResponsiveHeroImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Génère un srcset optimisé pour les hôtes qui redimensionnent à la volée.
 * Les URLs sont construites via l'API URL (chaîne de requête toujours valide).
 */
function generateSrcSet(src: string): string | undefined {
  return buildImageSrcSet(src);
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
  return buildImageUrl(src, { width: 1200, quality: 80 });
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
