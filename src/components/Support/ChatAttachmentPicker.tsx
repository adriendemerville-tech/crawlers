import { useState, useEffect } from 'react';
import { Plus, FileText, Code2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface AttachmentItem {
  id: string;
  type: 'report' | 'script';
  title: string;
  domain?: string;
  created_at: string;
}

interface ChatAttachmentPickerProps {
  userId: string;
  onAttach: (item: AttachmentItem) => void;
}

export function ChatAttachmentPicker({ userId, onAttach }: ChatAttachmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [tab, setTab] = useState<'report' | 'script'>('report');

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const fetchItems = async () => {
      const results: AttachmentItem[] = [];

      if (tab === 'report') {
        const { data } = await supabase
          .from('pdf_audits')
          .select('id, report_name, domain, created_at')
          .eq('user_id', userId)
          .eq('status', 'processed')
          .order('created_at', { ascending: false })
          .limit(20);

        (data || []).forEach((r: any) => {
          results.push({
            id: r.id,
            type: 'report',
            title: r.report_name || `Rapport ${r.domain}`,
            domain: r.domain,
            created_at: r.created_at,
          });
        });
      } else {
        const { data } = await supabase
          .from('site_script_rules')
          .select('id, url_pattern, payload_type, created_at, tracked_sites!site_script_rules_domain_id_fkey(domain)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        (data || []).forEach((s: any) => {
          results.push({
            id: s.id,
            type: 'script',
            title: `${s.payload_type} — ${s.url_pattern}`,
            domain: s.tracked_sites?.domain,
            created_at: s.created_at,
          });
        });
      }

      setItems(results);
      setLoading(false);
    };

    fetchItems();
  }, [open, tab, userId]);

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 shrink-0"
        onClick={() => setOpen(true)}
        title="Joindre un rapport ou script"
      >
        <Plus className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border bg-background shadow-xl z-10">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex gap-1">
          <Button
            variant={tab === 'report' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setTab('report')}
          >
            <FileText className="h-3 w-3" /> Rapports
          </Button>
          <Button
            variant={tab === 'script' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setTab('script')}
          >
            <Code2 className="h-3 w-3" /> Scripts
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <ScrollArea className="max-h-48 p-2">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Aucun {tab === 'report' ? 'rapport' : 'script'} trouvé.
          </p>
        ) : (
          <div className="space-y-1">
            {items.map(item => (
              <button
                key={item.id}
                className={cn(
                  'w-full text-left rounded-md px-2.5 py-2 text-xs hover:bg-muted/50 transition-colors',
                  'flex items-center justify-between gap-2'
                )}
                onClick={() => { onAttach(item); setOpen(false); }}
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  {item.domain && (
                    <p className="text-[10px] text-muted-foreground">{item.domain}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(item.created_at).toLocaleDateString('fr-FR')}
                </span>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
