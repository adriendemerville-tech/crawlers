import { Card, CardContent } from '@/components/ui/card';
import { Layers, ChevronDown } from 'lucide-react';
import { useState } from 'react';

/**
 * Explicite les trois modes de scan Marina et le fait que la bascule est
 * automatique (déduite du nombre d'URLs réellement découvertes sur le domaine).
 * Purement informatif : aucun réglage manuel n'est exposé, par choix produit.
 */

type Lang = 'fr' | 'en' | 'es';

const COPY: Record<Lang, {
  title: string;
  subtitle: string;
  cols: [string, string, string];
  rows: Array<[string, string, string]>;
  note: string;
}> = {
  fr: {
    title: 'Trois modes de scan, bascule automatique',
    subtitle:
      "Marina mesure d'abord la taille réelle du site (sitemap, map, CMS), puis choisit seule le mode. Le mode retenu et la couverture atteinte sont écrits dans l'introduction du rapport.",
    cols: ['Mode', 'Déclenchement', 'Pages analysées'],
    rows: [
      ['Approfondi', 'Site ≤ 120 URLs découvertes', "Jusqu'à 120 — couverture quasi exhaustive"],
      ['Standard', 'De 121 à 1 000 URLs', "Jusqu'à 150 — crawl large plafonné"],
      ['Échantillon', 'Plus de 1 000 URLs', '60 pages représentatives des gabarits'],
    ],
    note:
      "Au-delà de 1 000 URLs, un crawl intégral ne tient pas dans un seul run : l'échantillon par gabarit (accueil, catégorie, service, conversion, avis, éditorial) donne le même diagnostic sans exploser le temps d'exécution ni le coût.",
  },
  en: {
    title: 'Three scan modes, automatic switching',
    subtitle:
      "Marina first measures the site's real size (sitemap, map, CMS), then picks the mode itself. The selected mode and achieved coverage are stated in the report introduction.",
    cols: ['Mode', 'Trigger', 'Pages analysed'],
    rows: [
      ['Deep', 'Site ≤ 120 discovered URLs', 'Up to 120 — near-exhaustive coverage'],
      ['Standard', '121 to 1,000 URLs', 'Up to 150 — capped broad crawl'],
      ['Sample', 'More than 1,000 URLs', '60 template-representative pages'],
    ],
    note:
      'Above 1,000 URLs a full crawl cannot fit in a single run: template sampling yields the same diagnosis without blowing up runtime or cost.',
  },
  es: {
    title: 'Tres modos de escaneo, conmutación automática',
    subtitle:
      'Marina mide primero el tamaño real del sitio y luego elige el modo. El modo y la cobertura se indican en la introducción del informe.',
    cols: ['Modo', 'Activación', 'Páginas analizadas'],
    rows: [
      ['Profundo', 'Sitio ≤ 120 URL descubiertas', 'Hasta 120 — cobertura casi exhaustiva'],
      ['Estándar', 'De 121 a 1 000 URL', 'Hasta 150 — rastreo amplio limitado'],
      ['Muestra', 'Más de 1 000 URL', '60 páginas representativas'],
    ],
    note:
      'Por encima de 1 000 URL un rastreo íntegro no cabe en una ejecución: el muestreo por plantilla da el mismo diagnóstico.',
  },
};

export interface ActiveScanMode {
  mode: 'deep' | 'standard' | 'sample';
  maxPages: number;
  discoveredUrls: number | null;
  coveragePct: number | null;
  reason?: string;
}

const MODE_ROW_INDEX: Record<ActiveScanMode['mode'], number> = { deep: 0, standard: 1, sample: 2 };

export function MarinaScanModePanel({
  language = 'fr',
  active = null,
  pagesCrawled = null,
}: {
  language?: string;
  /** Mode réellement retenu pour le run en cours (renvoyé par le job). */
  active?: ActiveScanMode | null;
  pagesCrawled?: number | null;
}) {
  const lang: Lang = (language as Lang) in COPY ? (language as Lang) : 'fr';
  const t = COPY[lang];
  const activeIndex = active ? MODE_ROW_INDEX[active.mode] : -1;

  const activeLine = active
    ? lang === 'en'
      ? `Mode applied to this run: ${t.rows[activeIndex][0]} — up to ${active.maxPages} pages${active.discoveredUrls ? `, ${active.discoveredUrls} discovered URLs` : ''}${active.coveragePct !== null ? `, target coverage ${active.coveragePct}%` : ''}${pagesCrawled ? ` · ${pagesCrawled} pages crawled so far` : ''}.`
      : lang === 'es'
        ? `Modo aplicado a esta ejecución: ${t.rows[activeIndex][0]} — hasta ${active.maxPages} páginas${active.discoveredUrls ? `, ${active.discoveredUrls} URL descubiertas` : ''}${active.coveragePct !== null ? `, cobertura objetivo ${active.coveragePct} %` : ''}${pagesCrawled ? ` · ${pagesCrawled} páginas rastreadas` : ''}.`
        : `Mode retenu pour ce run : ${t.rows[activeIndex][0]} — jusqu'à ${active.maxPages} pages${active.discoveredUrls ? `, ${active.discoveredUrls} URLs découvertes` : ''}${active.coveragePct !== null ? `, couverture visée ${active.coveragePct} %` : ''}${pagesCrawled ? ` · ${pagesCrawled} pages déjà crawlées` : ''}.`
    : null;

  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="mt-4 border-border/60 bg-card/50 text-left">
      <CardContent className="p-5">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={isOpen}
        >
          <div className="flex items-start gap-3 min-w-0">
            <Layers className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 mt-0.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {isOpen && (
          <>
            {activeLine && (
              <p className="mt-3 rounded-md border border-primary/40 px-3 py-2 text-xs font-medium leading-relaxed text-foreground">
                {activeLine}
              </p>
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    {t.cols.map((c) => (
                      <th key={c} className="border-b border-border/60 pb-2 pr-4 font-medium uppercase tracking-wide">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r, i) => (
                    <tr key={r[0]} className={i === activeIndex ? 'align-top bg-primary/10' : 'align-top'}>
                      <td className="border-b border-border/40 py-2 pr-4 font-semibold text-foreground whitespace-nowrap">
                        {r[0]}
                      </td>
                      <td className="border-b border-border/40 py-2 pr-4 text-muted-foreground">{r[1]}</td>
                      <td className="border-b border-border/40 py-2 text-muted-foreground">{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t.note}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
