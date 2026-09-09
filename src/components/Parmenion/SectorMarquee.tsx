import { memo } from 'react';

const SECTORS = [
  'Artisans & BTP',
  'Restauration',
  'Santé & Bien-être',
  'Commerce & E-commerce',
  'Immobilier',
  'Services aux entreprises',
  'Tourisme & Loisirs',
  'Automobile',
  'Beauté & Coiffure',
];

function SectorMarqueeComponent(): React.ReactElement {
  const doubled = [...SECTORS, ...SECTORS];
  return (
    <div className="relative overflow-hidden py-2" aria-label="Secteurs couverts">
      <div className="flex w-max gap-3 animate-marquee motion-reduce:animate-none">
        {doubled.map((s, i) => (
          <span
            key={`${s}-${i}`}
            className="flex shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" />
            {s}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

export default memo(SectorMarqueeComponent);
