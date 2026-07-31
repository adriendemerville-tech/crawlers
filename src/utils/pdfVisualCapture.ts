/**
 * pdfVisualCapture — insertion d'un rendu réel (desktop + mobile) dans les PDF d'audit.
 *
 * Appelle l'edge function `site-visual-capture` (Pagebolt, cache 24 h),
 * télécharge les images signées et les ajoute sur une page dédiée du PDF.
 * Totalement non bloquant : en cas d'échec, le PDF est généré sans la page visuelle.
 */
import { supabase } from '@/integrations/supabase/client';

export type VisualCapture = {
  url: string;
  domain: string;
  desktop_url: string | null;
  mobile_url: string | null;
  captured_at: string;
  errors?: string[];
};

const LABELS = {
  fr: {
    title: 'Preuve visuelle',
    subtitle: 'Rendu réel capturé pendant l\'audit',
    desktop: 'Rendu desktop (page entière)',
    mobile: 'Rendu mobile',
    at: 'Capturé le',
  },
  en: {
    title: 'Visual evidence',
    subtitle: 'Real rendering captured during the audit',
    desktop: 'Desktop rendering (full page)',
    mobile: 'Mobile rendering',
    at: 'Captured at',
  },
  es: {
    title: 'Prueba visual',
    subtitle: 'Renderizado real capturado durante la auditoría',
    desktop: 'Renderizado escritorio (página completa)',
    mobile: 'Renderizado móvil',
    at: 'Capturado el',
  },
};

export async function fetchVisualCapture(url: string): Promise<VisualCapture | null> {
  try {
    const { data, error } = await supabase.functions.invoke('site-visual-capture', {
      body: { url, include_mobile: true },
    });
    if (error) {
      console.warn('[pdfVisualCapture] capture unavailable:', error.message);
      return null;
    }
    const capture = (data as { capture?: VisualCapture })?.capture ?? null;
    if (!capture || (!capture.desktop_url && !capture.mobile_url)) return null;
    return capture;
  } catch (err) {
    console.warn('[pdfVisualCapture] capture failed:', err);
    return null;
  }
}

type LoadedImage = { dataUrl: string; width: number; height: number };

async function loadImage(imageUrl: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    if (!dims.width || !dims.height) return null;
    return { dataUrl, ...dims };
  } catch (err) {
    console.warn('[pdfVisualCapture] image load failed:', err);
    return null;
  }
}

/**
 * Ajoute une page "Preuve visuelle" au document jsPDF fourni.
 * Retourne true si la page a été ajoutée.
 */
export async function addVisualEvidencePage(
  doc: any,
  url: string,
  language: string,
  capture?: VisualCapture | null,
): Promise<boolean> {
  const resolved = capture ?? (await fetchVisualCapture(url));
  if (!resolved) return false;

  const t = LABELS[(language as keyof typeof LABELS)] || LABELS.en;
  const [desktop, mobile] = await Promise.all([
    resolved.desktop_url ? loadImage(resolved.desktop_url) : Promise.resolve(null),
    resolved.mobile_url ? loadImage(resolved.mobile_url) : Promise.resolve(null),
  ]);
  if (!desktop && !mobile) return false;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const usableWidth = pageWidth - margin * 2;

  doc.addPage();
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(t.title, margin, 22);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(
    `${t.subtitle} — ${resolved.domain} · ${t.at} ${new Date(resolved.captured_at).toLocaleString()}`,
    margin,
    29,
  );

  let cursorY = 38;

  if (desktop) {
    const maxHeight = pageHeight - cursorY - (mobile ? 40 : 32);
    let width = usableWidth;
    let height = (desktop.height / desktop.width) * width;
    if (height > maxHeight) {
      height = maxHeight;
      width = (desktop.width / desktop.height) * height;
    }
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(t.desktop, margin, cursorY - 3);
    doc.addImage(desktop.dataUrl, 'JPEG', margin, cursorY, width, height, undefined, 'FAST');
    cursorY += height + 12;
  }

  if (mobile) {
    if (cursorY > pageHeight - 80) {
      doc.addPage();
      cursorY = 25;
    }
    const maxHeight = pageHeight - cursorY - 32;
    let height = Math.min(maxHeight, 120);
    let width = (mobile.width / mobile.height) * height;
    if (width > usableWidth) {
      width = usableWidth;
      height = (mobile.height / mobile.width) * width;
    }
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(t.mobile, margin, cursorY - 3);
    doc.addImage(mobile.dataUrl, 'JPEG', margin, cursorY, width, height, undefined, 'FAST');
  }

  return true;
}
