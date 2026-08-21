// Rendu PDF vectoriel d'un rapport HTML (Marina, audit expert…) par un Chromium réel.
//
// Pourquoi cette route existe : l'export client historique (html2canvas + jsPDF)
// est une capture d'écran raster. html2canvas réimplémente la mise en page du
// texte — il repositionne chaque mot et ignore `inline-flex`/`align-items`.
// D'où les deux défauts récurrents des PDF Marina, qu'aucun correctif CSS ne
// pouvait résoudre :
//   1. des espaces perdus dans les titres (« Synthèseexécutive ») ;
//   2. le texte des pastilles (« Mesuré », « Estimé ») décentré verticalement.
// Ici c'est Chromium qui imprime : texte vectoriel, espaces et centrages exacts.
//
// POST /api/render-report-pdf  body { html: string, landscape?: boolean }
//   → application/pdf

import { createFileRoute } from '@tanstack/react-router';

const BROWSERLESS_BASE_URL = 'https://production-sfo.browserless.io';
const MAX_HTML_BYTES = 12_000_000;

/** CSS d'impression : coupures propres, fond conservé, barre d'actions masquée. */
const PRINT_CSS = `
<style>
  @page { size: A4; margin: 14mm 10mm; }
  html, body { background: #ffffff !important; }
  body { padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .marina-toolbar { display: none !important; }
  .section, .toc, .reco-card, .stat-card, table, tr, figure { break-inside: avoid; }
  h1, h2, h3, h4 { break-after: avoid; }
  .marina-batch-part, .marina-batch-shared, .marina-batch-disclosure { break-before: page; }
  img { max-width: 100% !important; }
</style>
`;

const fail = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const Route = createFileRoute('/api/render-report-pdf')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env['RENDERING_API_KEY'] || process.env['BROWSERLESS_API_KEY'];
        if (!token) return fail('rendering_key_missing', 503);

        let html = '';
        let landscape = false;
        try {
          const body = (await request.json()) as { html?: unknown; landscape?: unknown };
          if (typeof body.html === 'string') html = body.html;
          landscape = body.landscape === true;
        } catch {
          return fail('invalid_json', 400);
        }

        if (html.length < 200) return fail('html_missing', 400);
        if (html.length > MAX_HTML_BYTES) return fail('html_too_large', 413);
        // Garde anti-usage détourné : on n'imprime que des rapports maison.
        if (!/Crawlers|marina|audit/i.test(html)) return fail('html_not_a_report', 422);

        const printable = html.includes('</head>')
          ? html.replace('</head>', `${PRINT_CSS}</head>`)
          : `${PRINT_CSS}${html}`;

        try {
          const res = await fetch(`${BROWSERLESS_BASE_URL}/pdf?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              html: printable,
              options: {
                format: 'A4',
                landscape,
                printBackground: true,
                preferCSSPageSize: true,
              },
              gotoOptions: { waitUntil: 'networkidle0', timeout: 60000 },
            }),
          });

          if (!res.ok) {
            const detail = await res.text().catch(() => '');
            console.error(`[render-report-pdf] renderer ${res.status}: ${detail.slice(0, 300)}`);
            return fail(`render_failed_${res.status}`, 502);
          }

          const pdf = await res.arrayBuffer();
          if (pdf.byteLength < 1000) return fail('render_empty', 502);

          return new Response(pdf, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Cache-Control': 'no-store',
            },
          });
        } catch (e) {
          console.error('[render-report-pdf] error', e instanceof Error ? e.message : e);
          return fail('render_exception', 502);
        }
      },
    },
  },
});
