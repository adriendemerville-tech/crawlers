import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop';
  os: string;
  browser: string;
  browserVersion: string;
  device: string;
}

interface ChatMessageProps {
  content: string;
  isAdmin: boolean;
  isOwn: boolean;
  createdAt: string;
  deviceInfo?: DeviceInfo | null;
  isAdminView?: boolean;
}

export function ChatMessage({ content, isAdmin, isOwn, createdAt, deviceInfo, isAdminView }: ChatMessageProps) {
  const DeviceIcon = deviceInfo?.type === 'mobile' ? Smartphone : deviceInfo?.type === 'tablet' ? Tablet : Monitor;

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

        {/* Device info — admin view only, on user messages */}
        {isAdminView && !isAdmin && deviceInfo && (
          <div className={cn(
            'flex items-center gap-1 mt-1.5 pt-1.5 border-t text-[9px] leading-tight',
            'border-primary-foreground/20 text-primary-foreground/50'
          )}>
            <DeviceIcon className="h-3 w-3 shrink-0" />
            <span>
              {deviceInfo.device !== 'Desktop' && deviceInfo.device !== 'Inconnu' ? `${deviceInfo.device} · ` : ''}
              {deviceInfo.os} · {deviceInfo.browser} {deviceInfo.browserVersion}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
