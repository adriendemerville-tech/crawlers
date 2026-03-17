import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Folder, Trash2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface FolderData {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
}

interface SortableFolderItemProps {
  folder: FolderData;
  onOpen: () => void;
  onDelete: () => void;
  translations: any;
}

export function SortableFolderItem({ folder, onOpen, onDelete, translations: t }: SortableFolderItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: `folder-${folder.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          onDoubleClick={onOpen}
          onClick={onOpen}
          className={`flex flex-col items-center gap-1.5 w-20 p-2 rounded-lg transition-colors cursor-pointer select-none group ${
            isOver ? 'bg-primary/10' : 'hover:bg-muted/60'
          }`}
          title={folder.name}
        >
          <Folder className="h-10 w-10 text-muted-foreground/70 group-hover:text-muted-foreground transition-colors fill-muted-foreground/10" />
          <span className="text-xs text-muted-foreground truncate w-full text-center leading-tight">
            {folder.name}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onDelete} className="gap-2 text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" />
          {t.delete}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
