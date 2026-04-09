// Dynamic imports to avoid 140KB bundle on initial load
import type jsPDF from 'jspdf';

const loadPDFLibraries = async () => {
  const [jspdfModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  return { jsPDF: jspdfModule.default, autoTable: autoTableModule.default };
};

interface IkAction {
  id: string;
  created_at: string;
  event_data: Record<string, unknown>;
}

function extractActionDetails(ev: IkAction): { url: string; action: string; description: string; date: string; time: string } {
  const ed = ev.event_data || {};
  const pageKey = (ed.page_key as string) || '';
  const action = (ed.action as string) || (ed.event_type as string) || 'action';
  const domain = (ed.domain as string) || 'iktracker.fr';
  const response = ed.response as Record<string, unknown> | undefined;
  const message = (response?.result as any)?.data?.data?.message || (ed.message as string) || '';
  const phase = (ed.pipeline_phase as string) || (ed.phase as string) || '';
  const status = (ed.final_status as string) || (ed.downstream_status as string) || '';

  // Build URL
  const url = pageKey ? `https://${domain}/blog/${pageKey}` : `https://${domain}`;

  // Build description
  let desc = '';
  if (typeof message === 'string' && message.length > 10) {
    // Clean the message: take first sentence or first 120 chars
    const cleaned = message.replace(/\[Cycle #\d+[^\]]*\]\s*/, '').replace(/\d+ phases — /, '');
    desc = cleaned.length > 150 ? cleaned.slice(0, 147) + '…' : cleaned;
  } else {
    const parts: string[] = [];
    if (action) parts.push(action);
    if (phase) parts.push(`phase: ${phase}`);
    if (status) parts.push(`statut: ${status}`);
    if (pageKey) parts.push(`page: ${pageKey}`);
    desc = parts.join(' · ');
  }

  // Parse date
  const d = new Date(ev.created_at);
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Determine action type label — use logged effective action if available
  let actionLabel = 'Modification';
  const effectiveAction = ((ed.action as string) || '').toLowerCase();
  const originalAction = ((ed.original_action as string) || '').toLowerCase();
  const wasUpserted = ed.was_upserted === true;
  const lowerAction = action.toLowerCase();
  const pipelinePhase = ((ed.pipeline_phase as string) || (ed.phase as string) || '').toLowerCase();
  const eventType = ((ed.event_type as string) || '').toLowerCase();

  // 1. push-event from autopilot = tracking event, NOT a page creation
  if (lowerAction === 'push-event' || effectiveAction === 'push-event') {
    // Determine label from pipeline phase or event_type
    if (pipelinePhase.includes('content') || eventType.includes('content')) {
      actionLabel = wasUpserted ? 'Mise à jour contenu' : 'Publication contenu';
    } else if (pipelinePhase.includes('code') || eventType.includes('code')) {
      actionLabel = 'Injection code';
    } else if (pipelinePhase.includes('diagnostic') || eventType.includes('diagnostic')) {
      actionLabel = 'Diagnostic';
    } else {
      actionLabel = 'Événement Autopilot';
    }
  } else if (wasUpserted) {
    actionLabel = 'Mise à jour (upsert)';
  } else if (effectiveAction.includes('update') || lowerAction.includes('update') || lowerAction.includes('patch')) {
    actionLabel = 'Modification';
  } else if (lowerAction.includes('create') || lowerAction.includes('post')) {
    actionLabel = 'Ajout de page';
  } else if (lowerAction === 'cms-push-draft' || lowerAction === 'cms-patch-content') {
    actionLabel = wasUpserted ? 'Mise à jour contenu' : 'Publication contenu';
  } else if (lowerAction.includes('delete') || lowerAction.includes('remove')) {
    actionLabel = 'Suppression';
  }

  return { url, action: actionLabel, description: desc, date, time };
}

export async function generateParmenionReport(events: IkAction[], domain: string = 'iktracker.fr') {
  const { jsPDF, autoTable } = await loadPDFLibraries();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const now = new Date();
  const reportDate = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const reportTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Rapport Parménion — Actions 24h', 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Domaine : ${domain}  ·  Généré le ${reportDate} à ${reportTime}  ·  ${events.length} action(s)`, 14, 26);

  doc.setDrawColor(200, 200, 200);
  doc.line(14, 29, 283, 29);

  if (events.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(150, 150, 150);
    doc.text('Aucune action enregistrée sur les dernières 24 heures.', 14, 42);
  } else {
    const rows = events.map(ev => {
      const { date, time, action, url, description } = extractActionDetails(ev);
      return [date, time, action, url, description];
    });

    autoTable(doc, {
      startY: 34,
      head: [['Date', 'Heure', 'Action', 'URL', 'Description']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 18 },
        2: { cellWidth: 28 },
        3: { cellWidth: 70, textColor: [30, 100, 180] },
        4: { cellWidth: 'auto' },
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer on each page
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Parménion · Crawlers.fr — Page ${data.pageNumber} / ${pageCount}`,
          14, doc.internal.pageSize.height - 8
        );
      },
    });
  }

  // Save
  const filename = `Parmenion_Rapport_24h_${domain}_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
