/**
 * ============================================================
 * COMPOSANT : BackendDocumentation
 * ============================================================
 * 
 * Page de documentation technique du backend intégrée au dashboard admin.
 * 
 * POUR MODIFIER LA DOCUMENTATION :
 * → Éditez le fichier src/data/backendDocumentation.ts
 * → Ajoutez/modifiez les sections dans le tableau `backendDocSections`
 * → Le rendu est automatique (Markdown parsé en HTML)
 * 
 * POUR AJOUTER UNE SECTION :
 * → Ajoutez un objet { id, title, icon, content } dans backendDocSections
 * → L'icône doit correspondre à un nom Lucide React
 * ============================================================
 */

import { useState, useRef } from 'react';
import { 
  Network, Database, Plug, Bug, Key, Package,
  FileDown, ChevronRight, BookOpen, Clock, Code2, Layers
} from 'lucide-react';
import { backendDocSections, docMetadata, type DocSection } from '@/data/backendDocumentation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ── Icon mapper ──────────────────────────────────────────
const iconMap: Record<string, React.ElementType> = {
  Network, Database, Plug, Bug, Key, Package,
};

function getIcon(name: string) {
  return iconMap[name] || BookOpen;
}

// ── Simple Markdown renderer ─────────────────────────────
// Converts Markdown to HTML without external dependencies.
// Supports: headings, tables, code blocks, bold, inline code, lists, links, horizontal rules
function renderMarkdown(md: string): string {
  let html = md;

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre class="doc-code-block" data-lang="${lang}"><code>${escaped}</code></pre>`;
  });

  // Tables
  html = html.replace(
    /(?:^|\n)(\|.+\|)\n(\|[ \-:|]+\|)\n((?:\|.+\|\n?)+)/gm,
    (_match, headerRow, _separator, bodyRows) => {
      const headers = headerRow.split('|').filter((c: string) => c.trim());
      const rows = bodyRows.trim().split('\n').map((r: string) =>
        r.split('|').filter((c: string) => c.trim())
      );
      let table = '<div class="doc-table-wrapper"><table class="doc-table"><thead><tr>';
      headers.forEach((h: string) => { table += `<th>${h.trim()}</th>`; });
      table += '</tr></thead><tbody>';
      rows.forEach((row: string[]) => {
        table += '<tr>';
        row.forEach((cell: string) => {
          // Parse inline code inside table cells
          const cellHtml = cell.trim().replace(/`([^`]+)`/g, '<code class="doc-inline-code">$1</code>');
          table += `<td>${cellHtml}</td>`;
        });
        table += '</tr>';
      });
      table += '</tbody></table></div>';
      return table;
    }
  );

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="doc-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="doc-h2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="doc-h1">$1</h1>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="doc-hr" />');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Inline code (outside of pre blocks)
  html = html.replace(/`([^`]+)`/g, '<code class="doc-inline-code">$1</code>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="doc-li">$1</li>');
  html = html.replace(/((?:<li class="doc-li">.*<\/li>\n?)+)/g, '<ul class="doc-ul">$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="doc-li-ordered">$1</li>');
  html = html.replace(/((?:<li class="doc-li-ordered">.*<\/li>\n?)+)/g, '<ol class="doc-ol">$1</ol>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="doc-link" target="_blank" rel="noopener">$1</a>');

  // Paragraphs (lines that aren't already wrapped)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p class="doc-p">$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p class="doc-p">\s*<\/p>/g, '');

  return html;
}

// ── PDF Generator ────────────────────────────────────────
async function generatePdf() {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const addPage = () => { doc.addPage(); y = 20; };
  const checkSpace = (needed: number) => { if (y + needed > 270) addPage(); };

  // Title page
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Documentation Technique', pageWidth / 2, 60, { align: 'center' });
  doc.text('Backend', pageWidth / 2, 75, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(docMetadata.projectName, pageWidth / 2, 100, { align: 'center' });
  doc.text(`Version ${docMetadata.version} — ${docMetadata.lastUpdated}`, pageWidth / 2, 110, { align: 'center' });
  doc.text(`${docMetadata.totalEdgeFunctions} Edge Functions • ${docMetadata.totalTables} tables • ${docMetadata.totalLinesOfCode} lignes`, pageWidth / 2, 120, { align: 'center' });

  // Table of contents
  addPage();
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Table des matières', margin, y);
  y += 12;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  backendDocSections.forEach((section, i) => {
    doc.text(`${i + 1}. ${section.title}`, margin + 5, y);
    y += 8;
  });

  // Content
  backendDocSections.forEach((section) => {
    addPage();
    // Strip markdown, keep plain text for PDF
    const plainText = section.content
      .replace(/```[\s\S]*?```/g, '[voir code dans la version web]')
      .replace(/\|[^\n]+\|/g, '') // Remove tables (too complex for basic PDF)
      .replace(/#{1,3}\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^- /gm, '• ')
      .trim();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(plainText, maxWidth);
    for (const line of lines) {
      checkSpace(5);
      doc.text(line, margin, y);
      y += 5;
    }
  });

  doc.save('documentation-backend.pdf');
}

// ── Main Component ───────────────────────────────────────
export function BackendDocumentation() {
  const [activeSection, setActiveSection] = useState(backendDocSections[0].id);
  const contentRef = useRef<HTMLDivElement>(null);

  const currentSection = backendDocSections.find(s => s.id === activeSection) || backendDocSections[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Documentation Backend</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">v{docMetadata.version}</Badge>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {docMetadata.lastUpdated}
              </span>
              <span className="flex items-center gap-1">
                <Code2 className="h-3 w-3" />
                {docMetadata.totalLinesOfCode} lignes
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {docMetadata.totalEdgeFunctions} fonctions
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={generatePdf} className="gap-2">
          <FileDown className="h-4 w-4" />
          Exporter PDF
        </Button>
      </div>

      {/* Layout */}
      <div className="flex gap-4 min-h-[600px]">
        {/* Sidebar navigation */}
        <nav className="w-56 shrink-0 hidden md:block">
          <div className="sticky top-4 space-y-1">
            {backendDocSections.map((section) => {
              const Icon = getIcon(section.icon);
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{section.title}</span>
                  {isActive && <ChevronRight className="h-3 w-3 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile tabs */}
        <div className="md:hidden w-full">
          <ScrollArea className="w-full pb-2">
            <div className="flex gap-1 mb-4">
              {backendDocSections.map((section) => {
                const Icon = getIcon(section.icon);
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {section.title}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            ref={contentRef}
            className="doc-content prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(currentSection.content) }}
          />
        </div>
      </div>
    </div>
  );
}
