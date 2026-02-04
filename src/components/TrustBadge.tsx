import { Star } from 'lucide-react';

const RATING_VALUE = 4.6;
const REVIEW_COUNT = 73;

interface TrustBadgeProps {
  className?: string;
}

export function TrustBadge({ className = '' }: TrustBadgeProps) {
  // Generate stars based on rating
  const fullStars = Math.floor(RATING_VALUE);
  const hasHalfStar = RATING_VALUE % 1 >= 0.5;
  
  return (
    <div className={`flex items-center justify-center gap-2 py-4 ${className}`}>
      <div className="flex items-center gap-0.5" aria-label={`Note: ${RATING_VALUE} sur 5`}>
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className="h-4 w-4"
            fill={i < fullStars || (i === fullStars && hasHalfStar) ? '#FFD700' : 'transparent'}
            stroke={i < fullStars || (i === fullStars && hasHalfStar) ? '#FFD700' : '#9ca3af'}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground font-medium">
        {RATING_VALUE}/5 ({REVIEW_COUNT} avis d'experts)
      </span>
    </div>
  );
}

// JSON-LD for SoftwareApplication with AggregateRating
export function SoftwareApplicationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Crawlers.fr',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.6',
      bestRating: '5',
      worstRating: '1',
      ratingCount: '73',
      reviewCount: '73',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
