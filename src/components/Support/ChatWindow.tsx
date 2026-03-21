import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { X, Send, Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CrawlersLogo } from './CrawlersLogo';
import { ChatAttachmentPicker } from './ChatAttachmentPicker';
import { ChatMicButton } from './ChatMicButton';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatWindowProps {
  onClose: () => void;
}

export function ChatWindow({ onClose }: ChatWindowProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatOpenTimeRef = useRef(Date.now());
  const conversationIdRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Track post-chat navigation for quality scoring
  const trackPostChatRoute = useCallback(async (route: string) => {
    const convId = conversationIdRef.current;
    if (!convId || !user) return;
    const delaySec = Math.round((Date.now() - chatOpenTimeRef.current) / 1000);
    try {
      await supabase.functions.invoke('sav-agent', {
        body: {
          action: 'track_post_chat',
          conversation_id: convId,
          user_id: user.id,
          post_chat_route: route,
          delay_seconds: delaySec,
        },
      });
    } catch {
      // non-blocking
    }
  }, [user]);

  // On close, track the current route
  const handleClose = useCallback(() => {
    if (conversationIdRef.current && messages.length > 0) {
      trackPostChatRoute(location.pathname);
    }
    onClose();
  }, [onClose, messages.length, location.pathname, trackPostChatRoute]);

  // Load existing conversation
  useEffect(() => {
    if (!user) return;
    const loadConversation = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('sav_conversations')
        .select('id, messages')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setConversationId(data.id);
        const msgs = (data.messages as any[]) || [];
        setMessages(msgs.map((m: any) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp || new Date().toISOString(),
        })));
      }
      setLoading(false);
    };
    loadConversation();
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setNewMessage('');
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('sav-agent', {
        body: {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          conversation_id: conversationId,
          user_id: user.id,
        },
      });

      if (error) throw error;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply || "Je transmets votre question à l'équipe.",
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      // Check if escalation should show phone prompt (after 3+ user messages)
      const userCount = updatedMessages.filter(m => m.role === 'user').length;
      if (userCount >= 3 && !phoneSent) {
        setShowPhonePrompt(true);
      }
    } catch (err) {
      console.error('SAV agent error:', err);
      const fallbackMsg: ChatMessage = {
        role: 'assistant',
        content: "Je transmets votre question à l'équipe Crawlers.fr. Vous recevrez une réponse sous 24h ouvrées.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setSending(false);
    }
  };

  const handlePhoneSubmit = async () => {
    if (!phoneNumber.match(/^0[67]\d{8}$/) || !conversationId) {
      toast({ title: 'Format invalide', description: 'Entrez un numéro au format 06 ou 07.', variant: 'destructive' });
      return;
    }

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('sav_conversations')
      .update({
        phone_callback: phoneNumber,
        phone_callback_expires_at: expiresAt,
      })
      .eq('id', conversationId);

    setPhoneSent(true);
    setShowPhonePrompt(false);
    setPhoneNumber('');

    const confirmMsg: ChatMessage = {
      role: 'assistant',
      content: "Merci ! Un membre de l'équipe vous rappellera rapidement. Votre numéro sera automatiquement effacé sous 48h.",
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, confirmMsg]);

    toast({ title: 'Demande enregistrée', description: 'Vous serez rappelé rapidement.' });
  };

  const handleNewConversation = async () => {
    setMessages([]);
    setConversationId(null);
    setShowPhonePrompt(false);
    setPhoneSent(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) {
    return (
      <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 rounded-lg border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <CrawlersLogo size={20} />
            <h3 className="font-semibold text-sm">Assistant SAV</h3>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none border border-[hsl(var(--brand-violet))] text-[hsl(var(--brand-violet))] bg-transparent hover:bg-[hsl(var(--brand-violet))]/10" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="p-6 text-center text-muted-foreground text-sm">
          <p>Connectez-vous pour contacter le support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 rounded-lg border bg-background shadow-xl flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3 shrink-0">
        <div className="flex items-center gap-2">
          <CrawlersLogo size={22} />
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <h3 className="font-semibold text-sm">Assistant SAV</h3>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2 rounded-none border border-[hsl(var(--brand-violet))] text-[hsl(var(--brand-violet))] bg-transparent hover:bg-[hsl(var(--brand-violet))]/10" onClick={handleNewConversation}>
              Nouveau
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none border border-[hsl(var(--brand-violet))] text-[hsl(var(--brand-violet))] bg-transparent hover:bg-[hsl(var(--brand-violet))]/10" onClick={handleClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3 [&>[data-radix-scroll-area-viewport]]:!overflow-y-auto [&_[data-radix-scroll-area-scrollbar]]:opacity-100 [&_[data-radix-scroll-area-scrollbar]]:w-1.5 [&_[data-radix-scroll-area-thumb]]:bg-muted-foreground/25" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 space-y-3">
            <div className="flex justify-center">
              <CrawlersLogo size={36} />
            </div>
            <p className="text-sm font-medium">Bonjour ! Je suis votre assistant SAV.</p>
            <p className="text-xs">Posez-moi vos questions sur les audits SEO, le GEO Score, vos crédits ou tout problème technique.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'assistant' ? 'justify-start' : 'justify-end')}>
                <div className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  msg.role === 'assistant'
                    ? 'bg-violet-100 dark:bg-violet-900/40 text-foreground'
                    : 'bg-primary text-primary-foreground'
                )}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <CrawlersLogo size={14} />
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
                            {children}
                          </a>
                        ),
                      }}
                    >{msg.content}</ReactMarkdown>
                  </div>
                  <span className={cn(
                    'text-[10px] block mt-1',
                    msg.role === 'assistant' ? 'text-violet-500 dark:text-violet-400' : 'text-primary-foreground/70'
                  )}>
                    {format(new Date(msg.timestamp), 'HH:mm', { locale: fr })}
                  </span>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-violet-100 dark:bg-violet-900/40 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CrawlersLogo size={14} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Phone callback prompt */}
      {showPhonePrompt && !phoneSent && (
        <div className="border-t px-3 py-2 bg-amber-50 dark:bg-amber-900/20 shrink-0">
          <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
            <Phone className="h-3 w-3 inline mr-1" />
            Souhaitez-vous être rappelé ? (donnée effacée sous 48h)
          </p>
          <div className="flex gap-2">
            <Input
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="06 XX XX XX XX"
              className="flex-1 h-8 text-xs"
              maxLength={10}
            />
            <Button size="sm" className="h-8 text-xs" onClick={handlePhoneSubmit}>Envoyer</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowPhonePrompt(false)}>Non</Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3 shrink-0 relative">
        <ChatAttachmentPicker
          userId={user.id}
          onAttach={(item) => {
            const prefix = item.type === 'report' ? '📄 Rapport' : '💻 Script';
            const attachText = `[${prefix}: ${item.title}${item.domain ? ` (${item.domain})` : ''}]\nExplique-moi ce ${item.type === 'report' ? 'rapport' : 'script'}.`;
            setNewMessage(attachText);
          }}
        />
        <div className="flex gap-1.5">
          <ChatMicButton
            onTranscript={(text) => setNewMessage(prev => prev ? `${prev} ${text}` : text)}
            disabled={sending}
          />
          <Input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Votre question..."
            disabled={sending}
            className="flex-1"
            maxLength={500}
          />
          <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
