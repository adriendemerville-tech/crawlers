import { useState } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Monitor, Smartphone, Tablet, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

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
  messageId?: string;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
}

export function ChatMessage({ content, isAdmin, isOwn, createdAt, deviceInfo, isAdminView, messageId, onEdit }: ChatMessageProps) {
  const DeviceIcon = deviceInfo?.type === 'mobile' ? Smartphone : deviceInfo?.type === 'tablet' ? Tablet : Monitor;
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [saving, setSaving] = useState(false);

  const canEdit = isAdminView && isAdmin && messageId && onEdit;

  const handleSaveEdit = async () => {
    if (!messageId || !onEdit || !editContent.trim()) return;
    setSaving(true);
    await onEdit(messageId, editContent.trim());
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className={cn('flex group', isAdmin ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm relative',
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

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px] text-sm bg-background/80"
              autoFocus
            />
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditing(false); setEditContent(content); }}>
                <X className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSaveEdit} disabled={saving}>
                <Check className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap break-words">{content}</p>
            {canEdit && (
              <button
                onClick={() => { setEditContent(content); setEditing(true); }}
                className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-violet-200 dark:hover:bg-violet-800"
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </>
        )}

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
