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
  // Messages admin à gauche en gris, messages utilisateur à droite en bleu
  // isAdmin = true signifie que le message vient du support (peu importe qui visualise)
  
  return (
    <div className={cn('flex', isAdmin ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
          isAdmin
            ? 'bg-violet-100 dark:bg-violet-900/40 text-foreground'
            : 'bg-primary text-primary-foreground'
        )}
      >
        {isAdmin && (
          <span className="text-xs font-medium text-violet-600 dark:text-violet-400 block mb-1">
            Support
          </span>
        )}
        <p className="whitespace-pre-wrap break-words">{content}</p>
        <span className={cn(
          'text-[10px] block mt-1',
          isAdmin 
            ? 'text-violet-500 dark:text-violet-400' 
            : 'text-primary-foreground/70'
        )}>
          {format(new Date(createdAt), 'HH:mm', { locale: fr })}
        </span>
      </div>
    </div>
  );
}
