/**
 * Section-based PDF export utility.
 * Instead of slicing a full-page capture at fixed pixel intervals (which cuts text/scores),
 * this utility captures each `[data-pdf-section]` element individually and places them
 * intelligently on PDF pages, avoiding mid-section page breaks.
 *
 * Une section « Portée et limites » est systématiquement ajoutée en fin de document
 * (voir src/lib/reports/auditDisclaimer.ts) — obligatoire sur tous les PDF exportés.
 */

import { renderDisclaimerHTML, type DisclaimerContext } from '@/lib/reports/auditDisclaimer';

interface SectionPdfOptions {
  /** The HTML string to render */
  htmlContent: string;
  /** Output filename */
  filename: string;
  /** Iframe render width in px (default 794 = A4 at 96dpi) */
  iframeWidth?: number;
  /** html2canvas scale factor (default 2) */
  scale?: number;
  /** Background color for capture (default #f8fafc) */
  backgroundColor?: string;
  /** Margins in mm */
  marginTop?: number;
  marginBottom?: number;
  marginSide?: number;
  /** Gap between sections in mm (default 2) */
  sectionGap?: number;
  /** Time to wait for HTML rendering in ms (default 1500) */
  renderDelay?: number;
  /**
   * Contexte du disclaimer final. Toujours ajouté : si omis, un contexte
   * générique est utilisé. `false` n'est accepté que si le HTML source
   * contient déjà [data-pdf-section="disclaimer"].
   */
  disclaimer?: DisclaimerContext;
  /** Progression de la capture (rapports fusionnés multipages : très nombreux blocs). */
  onProgress?: (done: number, total: number) => void;
  /** Nombre maximum de blocs capturés (garde-fou mémoire/temps). */
  maxSections?: number;
}

export async function generateSectionBasedPDF(options: SectionPdfOptions): Promise<void> {
  const {
    htmlContent,
    filename,
    iframeWidth = 794,
    backgroundColor = '#f8fafc',
    marginTop = 15,
    marginBottom = 15,
    marginSide = 10,
    sectionGap = 2,
    renderDelay = 1500,
    disclaimer,
    onProgress,
    maxSections = 320,
  } = options;



  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF } = await import('jspdf');

  // Render HTML in hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${iframeWidth}px;height:2000px;border:none;`;
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Cannot access iframe');
  }

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  await new Promise((r) => setTimeout(r, renderDelay));

  // On agrandit l'iframe à la hauteur réelle du contenu : sinon les blocs situés
  // hors du viewport de 2000px peuvent rester non peints et sortir vides du PDF.
  const fullHeight = Math.max(
    iframeDoc.documentElement?.scrollHeight || 0,
    iframeDoc.body?.scrollHeight || 0,
  );
  if (fullHeight > 0) {
    iframe.style.height = `${fullHeight}px`;
    await new Promise((r) => setTimeout(r, 250));
  }

  // Échelle adaptative : un rapport fusionné multipages fait plusieurs dizaines de
  // milliers de pixels de haut. À l'échelle 2, html2canvas saturait la mémoire de
  // l'onglet et l'export ne rendait jamais la main.
  const scale = options.scale ?? (fullHeight > 80000 ? 1 : fullHeight > 30000 ? 1.4 : 2);



  // Collect sections.
  // ATTENTION : certains rapports (Marina) ne balisent qu'une poignée de blocs
  // avec [data-pdf-section]. Si on se contentait de ces blocs, le PDF ne
  // contiendrait qu'une fraction du rapport. On parcourt donc TOUJOURS les
  // enfants directs du conteneur, en descendant sur [data-pdf-section] quand
  // un enfant en contient (contrôle fin), sinon on prend l'enfant lui-même.
  const container = (iframeDoc.querySelector('.container') || iframeDoc.body) as HTMLElement;

  const topLevel = Array.from(container.children) as HTMLElement[];
  let sections: HTMLElement[] = topLevel.flatMap((child) => {
    if (child.hasAttribute('data-pdf-section')) return [child];
    const tagged = Array.from(child.querySelectorAll('[data-pdf-section]')) as HTMLElement[];
    // On ne descend que si les blocs balisés couvrent l'essentiel de l'enfant,
    // sinon on perdrait le contenu non balisé.
    if (tagged.length > 0) {
      const taggedHeight = tagged.reduce((sum, el) => sum + el.offsetHeight, 0);
      if (taggedHeight >= (child.offsetHeight || 0) * 0.9) return tagged;
    }
    return [child];
  });

  sections = sections.filter((el) => el.offsetHeight > 8);

  if (sections.length === 0) sections = topLevel;

  // Un bloc plus haut qu'une page était découpé au pixel, ce qui coupait les
  // cadres en bas de page. On le remplace par ses sous-blocs paginables
  // (cartes `.section`, `.toc`, `.reco-card`…) afin que la coupure tombe
  // toujours entre deux cadres et non au milieu de l'un d'eux.
  const A4_CONTENT_PX = Math.round(((297 - marginTop - marginBottom) / (210 - marginSide * 2)) * (iframeWidth - 32));
  const PAGINABLE_CHILD = ':scope > .section, :scope > .toc, :scope > .header, :scope > [data-pdf-section], :scope > [data-marina-block], :scope > section, :scope > div';

  const expand = (el: HTMLElement, depth = 0): HTMLElement[] => {
    if (depth > 3 || el.offsetHeight <= A4_CONTENT_PX) return [el];
    const children = Array.from(el.querySelectorAll(PAGINABLE_CHILD)) as HTMLElement[];
    const usable = children.filter((c) => c.offsetHeight > 8);
    if (usable.length < 2) return [el];
    return usable.flatMap((c) => expand(c, depth + 1));
  };

  sections = sections.flatMap((s) => expand(s));


  // Disclaimer obligatoire en dernière section (sauf s'il est déjà dans le HTML source).
  // Ajouté APRÈS la collecte pour ne jamais court-circuiter le fallback ci-dessus.
  if (!container.querySelector('[data-pdf-section="disclaimer"]')) {
    const holder = iframeDoc.createElement('div');
    holder.innerHTML = renderDisclaimerHTML(disclaimer ?? { auditType: 'generic', language: 'fr' });
    const node = holder.firstElementChild as HTMLElement | null;
    if (node) {
      container.appendChild(node);
      await new Promise((r) => setTimeout(r, 120));
      sections.push(node);
    }
  }



  const pdfWidthMm = 210;
  const pdfHeightMm = 297;
  const usableHeightMm = pdfHeightMm - marginTop - marginBottom;
  const usableWidthMm = pdfWidthMm - marginSide * 2;
  const captureWidth = iframeWidth - 32; // account for container padding

  const doc = new jsPDF('p', 'mm', 'a4');
  let cursorY = marginTop;
  let isFirstElement = true;

  for (const section of sections) {
    // On capture chaque bloc à sa largeur réelle (les blocs imbriqués sont plus
    // étroits que le conteneur) puis on le recentre dans la zone utile, sinon
    // html2canvas ajoutait une bande blanche à droite.
    const measuredWidth = section.offsetWidth || section.scrollWidth || captureWidth;
    const nativeWidth = Math.max(1, Math.min(captureWidth, measuredWidth));
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(section, {
        scale,
        useCORS: true,
        allowTaint: true,
        width: nativeWidth,
        windowWidth: iframeWidth,
        logging: false,
        backgroundColor,
      });
    } catch {
      continue; // un bloc non capturable ne doit pas casser tout l'export
    }

    // Un canvas vide (bloc masqué, hauteur nulle) produisait des dimensions
    // NaN/0 et faisait échouer jsPDF.addImage → PDF vide ou tronqué.
    if (!canvas.width || !canvas.height) continue;

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const sectionWidthMm = usableWidthMm * (nativeWidth / captureWidth);
    const sectionX = marginSide + (usableWidthMm - sectionWidthMm) / 2;
    const sectionHeightMm = (canvas.height * sectionWidthMm) / canvas.width;

    if (!Number.isFinite(sectionWidthMm) || sectionWidthMm <= 0) continue;
    if (!Number.isFinite(sectionHeightMm) || sectionHeightMm <= 0) continue;

    if (!Number.isFinite(cursorY) || cursorY < marginTop) cursorY = marginTop;
    const spaceLeft = pdfHeightMm - marginBottom - cursorY;

    // Un seul bloc ne doit jamais faire échouer l'export complet.
    const place = (img: string, y: number, w: number, h: number) => {
      if (!img.startsWith('data:image') || !Number.isFinite(h) || h <= 0) return false;
      try {
        doc.addImage(img, 'JPEG', sectionX, y, w, h);
        return true;
      } catch {
        return false;
      }
    };

    if (sectionHeightMm <= spaceLeft) {
      // Fits on current page
      place(imgData, cursorY, sectionWidthMm, sectionHeightMm);
      cursorY += sectionHeightMm + sectionGap;
    } else if (sectionHeightMm <= usableHeightMm) {
      // Fits on a fresh page (don't break it)
      if (!isFirstElement || cursorY > marginTop + 5) {
        doc.addPage();
        cursorY = marginTop;
      }
      place(imgData, cursorY, sectionWidthMm, sectionHeightMm);
      cursorY += sectionHeightMm + sectionGap;
    } else {
      // Section is taller than one full page — must slice (rare: huge tables)
      const pixelsPerMm = canvas.height / sectionHeightMm;
      let srcYPx = 0;
      let remaining = sectionHeightMm;
      let guard = 0;

      while (remaining > 0.5 && guard++ < 400) {
        // Si la page courante est déjà pleine, on repart d'une page vierge :
        // sinon `pageSpace` devenait nul ou négatif et jsPDF recevait des
        // dimensions invalides (export interrompu, PDF tronqué).
        let pageSpace = (pdfHeightMm - marginBottom) - cursorY;
        if (pageSpace < 5) {
          doc.addPage();
          cursorY = marginTop;
          pageSpace = usableHeightMm;
        }

        const sliceHeightMm = Math.min(remaining, pageSpace);
        const sliceHeightPx = Math.min(
          Math.max(1, Math.round(sliceHeightMm * pixelsPerMm)),
          Math.max(1, canvas.height - srcYPx),
        );

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, srcYPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
          place(sliceCanvas.toDataURL('image/jpeg', 0.92), cursorY, sectionWidthMm, sliceHeightMm);
        }

        srcYPx += sliceHeightPx;
        remaining -= sliceHeightMm;
        cursorY += sliceHeightMm;

        if (remaining > 0.5) {
          doc.addPage();
          cursorY = marginTop;
        }
      }
      cursorY += sectionGap;
    }
    isFirstElement = false;
  }


  document.body.removeChild(iframe);
  doc.save(filename);
}
