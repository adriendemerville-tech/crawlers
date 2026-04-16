/**
 * Section-based PDF export utility.
 * Instead of slicing a full-page capture at fixed pixel intervals (which cuts text/scores),
 * this utility captures each `[data-pdf-section]` element individually and places them
 * intelligently on PDF pages, avoiding mid-section page breaks.
 */

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
}

export async function generateSectionBasedPDF(options: SectionPdfOptions): Promise<void> {
  const {
    htmlContent,
    filename,
    iframeWidth = 794,
    scale = 2,
    backgroundColor = '#f8fafc',
    marginTop = 15,
    marginBottom = 15,
    marginSide = 10,
    sectionGap = 2,
    renderDelay = 1500,
  } = options;

  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF } = await import('jspdf');

  // Render HTML in hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${iframeWidth}px;border:none;`;
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

  // Collect sections: prefer [data-pdf-section] for fine-grained control,
  // fall back to direct children of .container
  const container = iframeDoc.querySelector('.container') || iframeDoc.body;
  let sections = Array.from(container.querySelectorAll('[data-pdf-section]')) as HTMLElement[];

  if (sections.length === 0) {
    // Fallback: use direct children
    sections = Array.from(container.children) as HTMLElement[];
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
    const canvas = await html2canvas(section, {
      scale,
      useCORS: true,
      allowTaint: true,
      width: captureWidth,
      windowWidth: iframeWidth,
      logging: false,
      backgroundColor,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const sectionWidthMm = usableWidthMm;
    const sectionHeightMm = (canvas.height * sectionWidthMm) / canvas.width;

    const spaceLeft = pdfHeightMm - marginBottom - cursorY;

    if (sectionHeightMm <= spaceLeft) {
      // Fits on current page
      doc.addImage(imgData, 'JPEG', marginSide, cursorY, sectionWidthMm, sectionHeightMm);
      cursorY += sectionHeightMm + sectionGap;
    } else if (sectionHeightMm <= usableHeightMm) {
      // Fits on a fresh page (don't break it)
      if (!isFirstElement || cursorY > marginTop + 5) {
        doc.addPage();
        cursorY = marginTop;
      }
      doc.addImage(imgData, 'JPEG', marginSide, cursorY, sectionWidthMm, sectionHeightMm);
      cursorY += sectionHeightMm + sectionGap;
    } else {
      // Section is taller than one full page — must slice (rare: huge tables)
      const pixelsPerMm = canvas.height / sectionHeightMm;
      let srcYPx = 0;
      let remaining = sectionHeightMm;

      while (remaining > 0) {
        const pageSpace = (pdfHeightMm - marginBottom) - cursorY;
        const sliceHeightMm = Math.min(remaining, pageSpace);
        const sliceHeightPx = Math.round(sliceHeightMm * pixelsPerMm);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, srcYPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
          const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.92);
          doc.addImage(sliceImg, 'JPEG', marginSide, cursorY, sectionWidthMm, sliceHeightMm);
        }

        srcYPx += sliceHeightPx;
        remaining -= sliceHeightMm;
        cursorY += sliceHeightMm;

        if (remaining > 0) {
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
