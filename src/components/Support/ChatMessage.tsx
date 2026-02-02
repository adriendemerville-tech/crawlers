import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ChatMessageProps {
  content: string;
  isAdmin: boolean;
  isOwn: boolean;
  createdAt: string;
}

export function ChatMessage({ content, isAdmin, isOwn, createdAt }: ChatMessageProps) {
  return (
    <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
          isOwn
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {isAdmin && !isOwn && (
          <span className="text-xs font-medium text-primary block mb-1">
            Support
          </span>
        )}
        <p className="whitespace-pre-wrap break-words">{content}</p>
        <span className={cn(
          'text-[10px] block mt-1',
          isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )}>
          {format(new Date(createdAt), 'HH:mm', { locale: fr })}
        </span>
      </div>
    </div>
  );
}
