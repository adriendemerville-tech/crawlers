import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, Trash2, Download, MoreVertical, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface SortableReportItemProps {
  report: Report;
  onDelete: () => void;
  translations: any;
}

export function SortableReportItem({ report, onDelete, translations: t }: SortableReportItemProps) {
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

  const reportHref = `/rapport/${report.id}`;

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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Plus d'options"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {report.pdf_url && (
            <DropdownMenuItem asChild>
              <a href={report.pdf_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                <Download className="h-4 w-4" />
                {t.download}
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4" />
            {t.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

