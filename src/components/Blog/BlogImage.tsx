import { memo } from 'react';

interface BlogImageProps {
  /** Image source URL (main fallback) */
  src: string;
  /** Strictly required alt text for accessibility and SEO */
  alt: string;
  /** Optional AVIF source for modern browsers */
  srcAvif?: string;
  /** Optional WebP source */
  srcWebp?: string;
  /** Responsive srcset string (e.g. "img-400.webp 400w, img-800.webp 800w") */
  srcSet?: string;
  /** Sizes attribute for responsive images */
  sizes?: string;
  /** Fixed width to prevent CLS */
  width: number;
  /** Fixed height to prevent CLS */
  height: number;
  /** If true: loading="eager" + fetchpriority="high". Default false → lazy */
  isHero?: boolean;
  /** Optional figcaption for SEO context */
  caption?: string;
  /** Additional className on figure */
  className?: string;
}

/**
 * Ultra-optimized blog image component for Core Web Vitals.
 * 
 * - Semantic <figure> + optional <figcaption>
 * - <picture> with AVIF > WebP > fallback chain
 * - srcset + sizes for responsive resolution
 * - Fixed width/height to eliminate CLS
 * - Lazy by default, eager+high-priority for hero images
 * - Target: <50KB per image
 */
function BlogImageComponent({
  src,
  alt,
  srcAvif,
  srcWebp,
  srcSet,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px',
  width,
  height,
  isHero = false,
  caption,
  className = '',
}: BlogImageProps) {
  return (
    <figure className={`overflow-hidden ${className}`}>
      <picture>
        {/* AVIF — best compression, modern browsers */}
        {srcAvif && (
          <source srcSet={srcAvif} type="image/avif" />
        )}
        {/* WebP — wide support, good compression */}
        {srcWebp && (
          <source srcSet={srcWebp} type="image/webp" />
        )}
        {/* Fallback <img> with full attributes */}
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          loading={isHero ? 'eager' : 'lazy'}
          fetchPriority={isHero ? 'high' : undefined}
          decoding="async"
          className="w-full h-auto object-cover"
          style={{ aspectRatio: `${width}/${height}` }}
        />
      </picture>
      {caption && (
        <figcaption className="mt-2 text-xs text-muted-foreground text-center italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export const BlogImage = memo(BlogImageComponent);
