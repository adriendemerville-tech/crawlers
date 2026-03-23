import { useState, useEffect, useRef, useCallback, type WheelEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, Send, Loader2, Phone, ArrowRight, Bug, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
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

// NLP detection for bug/problem intent
const BUG_KEYWORDS = [
  'bug', 'problème', 'probleme', 'erreur', 'error', 'ne marche pas', 'marche pas',
  'ne fonctionne pas', 'fonctionne pas', 'cassé', 'casse', 'broken', 'crash',
  'planté', 'plante', 'bloqué', 'bloque', 'écran blanc', 'page blanche',
  'ne charge pas', 'charge pas', 'ne s\'affiche pas', 'n\'affiche pas',
  'dysfonctionnement', 'anomalie', 'souci', 'incident', 'défaut',
  'ça bug', 'ca bug', 'ça plante', 'ca plante', 'il manque', 'missing',
  'pas normal', 'bizarre', 'weird', 'issue', 'not working',
];

function detectBugIntent(message: string): boolean {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return BUG_KEYWORDS.some(kw => {
    const normalizedKw = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lower.includes(normalizedKw);
  });
}

export function ChatWindow({ onClose }: ChatWindowProps) {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const chatOpenTimeRef = useRef(Date.now());
  const conversationIdRef = useRef<string | null>(null);
  const getScrollViewport = useCallback(() => {
    return scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
  }, []);

  const handleFelixWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('textarea, input')) return;

    const viewport = getScrollViewport();
    if (!viewport || viewport.scrollHeight <= viewport.clientHeight) return;

    event.preventDefault();
    event.stopPropagation();
    viewport.scrollTop += event.deltaY;
  }, [getScrollViewport]);

  // Bug report state
  const [bugReportMode, setBugReportMode] = useState<'idle' | 'prompt' | 'waiting' | 'sent'>('idle');

  // Resolved bug notifications
  const [resolvedBugs, setResolvedBugs] = useState<{ id: string; cto_response: string }[]>([]);

  // Keep ref in sync
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Check for resolved bug reports on mount
  useEffect(() => {
    if (!user) return;
    const checkResolvedBugs = async () => {
      const { data } = await supabase
        .from('user_bug_reports')
        .select('id, cto_response')
        .eq('user_id', user.id)
        .eq('status', 'resolved')
        .eq('notified_user', false);

      if (data && data.length > 0) {
        setResolvedBugs(data as any[]);
        // Show notification messages
        const notifMsgs: ChatMessage[] = data.map((bug: any) => ({
          role: 'assistant' as const,
          content: `✅ **Bonne nouvelle !** Un problème que vous aviez signalé a été résolu.\n\n${bug.cto_response || 'Le problème a été corrigé.'}`,
          timestamp: new Date().toISOString(),
        }));
        setMessages(prev => [...notifMsgs, ...prev]);

        // Mark as notified
        await supabase
          .from('user_bug_reports')
          .update({ notified_user: true })
          .in('id', data.map((b: any) => b.id));
      }
    };
    checkResolvedBugs();
  }, [user]);

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
        setMessages(prev => [
          ...prev, // keep resolved bug notifications at top
          ...msgs.map((m: any) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp || new Date().toISOString(),
          })),
        ]);
      }
      setLoading(false);
    };
    loadConversation();
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    const viewport = getScrollViewport();
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, getScrollViewport]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();

    // Bug report: waiting for the actual report message
    if (bugReportMode === 'waiting') {
      await submitBugReport(messageText);
      return;
    }

    // Check if user is expressing a bug intent
    if (bugReportMode === 'idle' && detectBugIntent(messageText)) {
      setBugReportMode('prompt');
      // Still send the message normally to the SAV agent
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: messageText,
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
          user_id: user?.id || null,
          guest_mode: !user,
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

      // Check if escalation should show phone prompt (after 8+ user messages) — skip for admins and guests
      const userCount = updatedMessages.filter(m => m.role === 'user').length;
      if (user && userCount >= 8 && !phoneSent && !isAdmin) {
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

  const submitBugReport = async (message: string) => {
    if (!user) return;
    setSending(true);

    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setNewMessage('');

    try {
      const { data, error } = await supabase.functions.invoke('submit-bug-report', {
        body: {
          raw_message: message,
          route: location.pathname,
          source_assistant: 'crawler',
          context_data: {
            user_agent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            conversation_id: conversationId,
          },
        },
      });

      if (error) throw error;

      const confirmMsg: ChatMessage = {
        role: 'assistant',
        content: "Merci pour votre aide et votre vigilance ! Nous reviendrons rapidement vers vous. 🙏",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, confirmMsg]);
      setBugReportMode('sent');
      toast({ title: 'Signalement envoyé', description: 'Merci pour votre retour !' });
    } catch (err: any) {
      console.error('Bug report error:', err);
      const errorMsg = err?.message?.includes('429') || err?.message?.includes('Limite')
        ? 'Vous avez atteint la limite de 3 signalements par jour.'
        : err?.message?.includes('409') || err?.message?.includes('duplicate')
        ? 'Un signalement similaire a déjà été envoyé récemment.'
        : "Désolé, le signalement n'a pas pu être envoyé. Réessayez plus tard.";

      const errorChatMsg: ChatMessage = {
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorChatMsg]);
      setBugReportMode('idle');
    } finally {
      setSending(false);
    }
  };

  const activateBugReportMode = () => {
    setBugReportMode('waiting');
    const promptMsg: ChatMessage = {
      role: 'assistant',
      content: "Pas de problème ! Votre prochain message sera le signalement. Décrivez le problème rencontré, la page concernée et ce que vous attendiez. C'est à vous. 📝",
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, promptMsg]);
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
    setBugReportMode('idle');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px';
  };

  if (!user) {
    // Guest mode — no login required, simple chat interface
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-[19rem] sm:w-[24rem] rounded-2xl border border-border/50 bg-background/95 backdrop-blur-lg shadow-2xl flex flex-col max-h-[75vh] overflow-hidden overscroll-contain" onWheelCapture={handleFelixWheel}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <CrawlersLogo size={16} />
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-foreground/80">Félix</span>
          {isAdmin && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Shield className="h-2 w-2" /> Créateur
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={handleNewConversation} className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-muted/50 transition-colors">
              Nouveau
            </button>
          )}
          <button onClick={handleClose} className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 z-10 bg-gradient-to-b from-background via-background/60 to-transparent" />
      <ScrollArea className="h-full px-4 py-3 overscroll-contain [&>[data-radix-scroll-area-viewport]]:!h-full [&>[data-radix-scroll-area-viewport]]:!overflow-y-auto [&>[data-radix-scroll-area-viewport]]:!overflow-x-hidden [&>[data-radix-scroll-area-viewport]]:overscroll-contain [&_[data-radix-scroll-area-scrollbar][data-orientation=vertical]]:!opacity-100 [&_[data-radix-scroll-area-scrollbar][data-orientation=vertical]]:!w-2 [&_[data-radix-scroll-area-thumb]]:!bg-muted-foreground/40 [&_[data-radix-scroll-area-thumb]]:!rounded-full" ref={scrollAreaRef}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 space-y-2">
            <div className="flex justify-center">
              <CrawlersLogo size={28} />
            </div>
           <p className="text-xs font-medium">Salut moi c'est Félix !</p>
            {isAdmin ? (
              <p className="text-[11px] text-muted-foreground/70">Mode Créateur — posez vos questions sur le backend, les tables ou les fonctions.</p>
            ) : !user ? (
              <p className="text-[11px] text-muted-foreground/70">Je serai toujours dispo pour répondre à tes questions sur Crawlers.fr et t'aider à booster ta visibilité SEO et IA. Tu veux en savoir plus ?</p>
            ) : (
              <p className="text-[11px] text-muted-foreground/70">Je serai toujours dispo pour te filer un coup de main et t'aider à analyser les metrics de tes sites. Tu as une première question ?</p>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'assistant' ? 'justify-start' : 'justify-end')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 overflow-hidden break-words',
                  msg.role === 'assistant'
                    ? 'bg-muted/60 text-foreground rounded-bl-md'
                    : 'bg-violet-600 text-white rounded-br-md'
                )}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <CrawlersLogo size={12} />
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words overflow-hidden prose prose-xs dark:prose-invert max-w-none text-[13px] leading-relaxed [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
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
                  {/* Action buttons for internal links */}
                  {(() => {
                    const linkRegex = /\[([^\]]+)\]\(https?:\/\/crawlers\.fr(\/[^\s)]+)\)/g;
                    const actions: { label: string; path: string }[] = [];
                    let m;
                    while ((m = linkRegex.exec(msg.content)) !== null) {
                      const path = m[2];
                      if (['/site-crawl', '/cocoon', '/console', '/audit-expert', '/matrice', '/architecte-generatif'].some(p => path.startsWith(p))) {
                        actions.push({ label: m[1], path });
                      }
                    }
                    if (actions.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {actions.map((a, idx) => (
                          <button
                            key={idx}
                            onClick={() => { navigate(a.path); onClose(); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-muted-foreground/20 text-muted-foreground text-[11px] font-medium hover:bg-muted/50 hover:text-foreground transition-all"
                          >
                            {a.label}
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}

            {/* Bug report prompt button */}
            {bugReportMode === 'prompt' && (
              <div className="flex justify-start">
                <button
                  onClick={activateBugReportMode}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                >
                  <Bug className="h-3.5 w-3.5" />
                  Signaler un problème / bug
                </button>
              </div>
            )}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted/60 rounded-2xl rounded-bl-md px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <CrawlersLogo size={12} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-1 w-1 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div className="h-6 shrink-0" />
          </div>
        )}
      </ScrollArea>
      </div>

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
            <Button size="sm" className="h-7 text-xs rounded-none border border-[hsl(var(--brand-violet))] text-[hsl(var(--brand-violet))] bg-transparent hover:bg-[hsl(var(--brand-violet))]/10" onClick={handlePhoneSubmit}>Envoyer</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs rounded-none border border-[hsl(var(--brand-violet))]/30 text-[hsl(var(--brand-violet))] bg-transparent hover:bg-[hsl(var(--brand-violet))]/10" onClick={() => setShowPhonePrompt(false)}>Non</Button>
          </div>
        </div>
      )}

      {/* Bug report mode indicator */}
      {bugReportMode === 'waiting' && (
        <div className="border-t px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 shrink-0">
          <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <Bug className="h-3 w-3" /> Mode signalement actif — décrivez votre problème
          </p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/30 px-2 py-1 shrink-0 relative">
        <div className="flex items-end gap-1">
          <textarea
            value={newMessage}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={bugReportMode === 'waiting' ? 'Décrivez le problème...' : 'Votre question...'}
            disabled={sending}
            className="flex-1 min-h-[2rem] max-h-[6rem] resize-none overflow-y-auto rounded-xl border border-border/40 bg-muted/30 px-3 py-1.5 text-[12px] ring-offset-background placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/30 caret-primary transition-colors"
            maxLength={isAdmin ? 2000 : 500}
            rows={1}
            style={{ height: 'auto' }}
            ref={(el) => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 96) + 'px';
              }
            }}
          />
          <div className="flex items-center gap-0.5 shrink-0">
            {user && (
              <ChatAttachmentPicker
                userId={user.id}
                onAttach={(item) => {
                  const prefix = item.type === 'report' ? '📄 Rapport' : '💻 Script';
                  const attachText = `[${prefix}: ${item.title}${item.domain ? ` (${item.domain})` : ''}]\nExplique-moi ce ${item.type === 'report' ? 'rapport' : 'script'}.`;
                  setNewMessage(attachText);
                }}
                onImageAttach={(fileName) => {
                  setNewMessage(prev => prev ? `${prev}\n[📷 Image: ${fileName}]` : `[📷 Image: ${fileName}]`);
                }}
              />
            )}
            <ChatMicButton
              onTranscript={(text) => setNewMessage(prev => prev ? `${prev} ${text}` : text)}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="h-7 w-7 shrink-0 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
