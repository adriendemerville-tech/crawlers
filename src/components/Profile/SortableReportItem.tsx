import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, Trash2, GripVertical, Send, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Report {
  id: string;
  title: string;
  url: string;
  report_type: string;
  folder_id: string | null;
  position: number;
  created_at: string;
  pdf_url: string | null;
}

interface AgencyClient {
  first_name: string;
  last_name: string;
  email: string | null;
}

interface SortableReportItemProps {
  report: Report;
  onDelete: () => void;
  translations: any;
  isProUser?: boolean;
  findClientForUrl?: (url: string) => AgencyClient | null;
  profileSignature?: string;
}

export function SortableReportItem({ report, onDelete, translations: t, isProUser, findClientForUrl, profileSignature }: SortableReportItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `report-${report.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getReportTypeLabel = (type: string) => {
    return t.reportTypes[type as keyof typeof t.reportTypes] || type;
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'seo_technical':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'seo_strategic':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'llm':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'geo':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'pagespeed':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'crawlers':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formattedDate = new Date(report.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const reportHref = `/app/rapport/${report.id}`;

  const handleSendToClient = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!findClientForUrl) return;
    const client = findClientForUrl(report.url);
    const reportTypeLabel = getReportTypeLabel(report.report_type);
    const reportLink = `${window.location.origin}${reportHref}`;
    const signature = profileSignature || '';

    const clientName = client ? `${client.first_name} ${client.last_name}` : '';
    const clientEmail = client?.email || '';

    const body = client
      ? `Bonjour ${clientName},\n\nVoici votre rapport ${reportTypeLabel} pour ${report.url} :\n${reportLink}\n\nBien à vous,\n${signature}`
      : `Bonjour,\n\nVoici votre rapport ${reportTypeLabel} pour ${report.url} :\n${reportLink}\n\nBien à vous,\n${signature}`;

    const subject = `Rapport ${reportTypeLabel} – ${report.url}`;
    const mailtoUrl = `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open report in new tab for viewing/downloading
    window.open(reportHref, '_blank');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      
      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      
      <a
        href={reportHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{report.title}</span>
          <Badge variant="secondary" className={`text-xs ${getReportTypeColor(report.report_type)}`}>
            {getReportTypeLabel(report.report_type)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{report.url}</span>
          <span>•</span>
          <span>{formattedDate}</span>
        </div>
      </a>

      <div className="flex items-center gap-1">
        {/* Download button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
          aria-label={t.download || 'Download'}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </Button>

        {/* Send to client button (Pro Agency only) */}
        {isProUser && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSendToClient}
            className="h-8 w-8 text-muted-foreground hover:text-violet-500 opacity-0 group-hover:opacity-100 transition-all"
            aria-label="Envoyer au client"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
          aria-label={t.delete}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
