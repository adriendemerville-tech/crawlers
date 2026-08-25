/** Inline SVG of the Crawlers robot logo — no external file dependency */
export function CrawlersLogo({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="chatBotGrad" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#d4a853' }} />
          <stop offset="30%" style={{ stopColor: '#8b5cf6' }} />
          <stop offset="70%" style={{ stopColor: '#7c3aed' }} />
          <stop offset="100%" style={{ stopColor: '#3b5998' }} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="48" rx="10" ry="10" fill="url(#chatBotGrad)" />
      <g
        transform="translate(9, 7.5) scale(1.25)"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeOpacity="1"
      >
        <path d="M12 8V4H8" />
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M9 13v2" />
        <path d="M15 13v2" />
      </g>
    </svg>
  );
}
