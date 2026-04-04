import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Send, Loader2, CheckCircle, Clock, User, Reply } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChatMessage } from '@/components/Support/ChatMessage';

const CLOSING_FORMULAS = [
  'Bien à vous,',
  'Cordialement,',
  'Bonne journée,',
  'À bientôt,',
];

function getRandomClosing(): string {
  const formula = CLOSING_FORMULAS[Math.floor(Math.random() * CLOSING_FORMULAS.length)];
  return `\n\n${formula}\nL'équipe de Crawlers.`;
}

interface Conversation {
  id: string;
  user_id: string;
  subject: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
  unread_count?: number;
  last_message?: string;
}

interface Message {
  id: string;
  content: string;
  is_admin: boolean;
  sender_id: string;
  created_at: string;
  device_info?: any;
}

export function SupportManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyingSending, setReplyingSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from('support_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        setLoading(false);
        return;
      }

      const enrichedConversations = await Promise.all(
        (data || []).map(async (conv) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, first_name, last_name')
            .eq('user_id', conv.user_id)
            .maybeSingle();

          const { data: lastMsg } = await supabase
            .from('support_messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { count } = await supabase
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_admin', false)
            .is('read_at', null);

          return {
            ...conv,
            user_email: profile?.email || 'Inconnu',
            user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Utilisateur',
            last_message: lastMsg?.content,
            unread_count: count || 0,
          };
        })
      );

      setConversations(enrichedConversations);
      setLoading(false);
    };

    fetchConversations();

    const channel = supabase
      .channel('admin-conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch messages when conversation selected
  useEffect(() => {
    if (!selectedConversation) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);

      await supabase
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', selectedConversation.id)
        .eq('is_admin', false)
        .is('read_at', null);
    };

    fetchMessages();

    const channel = supabase
      .channel(`admin-messages:${selectedConversation.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_messages',
        filter: `conversation_id=eq.${selectedConversation.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages((prev) => [...prev, payload.new as Message]);
        } else if (payload.eventType === 'UPDATE') {
          setMessages((prev) => prev.map(m => m.id === (payload.new as Message).id ? payload.new as Message : m));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !selectedConversation) return;

    setSending(true);
    const messageContent = newMessage.trim() + getRandomClosing();
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          content: messageContent,
          is_admin: true,
        });

      if (error) throw error;

      await supabase
        .from('support_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Erreur', description: "Impossible d'envoyer le message", variant: 'destructive' });
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  // Re-reply: add a second admin response after an existing admin message
  const handleReReply = async () => {
    if (!replyContent.trim() || !user || !selectedConversation) return;

    setReplyingSending(true);
    const messageContent = replyContent.trim() + getRandomClosing();

    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          content: messageContent,
          is_admin: true,
        });

      if (error) throw error;

      await supabase
        .from('support_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      setReplyContent('');
      setReplyingToId(null);
    } catch (error) {
      console.error('Error sending re-reply:', error);
      toast({ title: 'Erreur', description: "Impossible d'envoyer le message", variant: 'destructive' });
    } finally {
      setReplyingSending(false);
    }
  };

  // Edit an existing message silently (no notification)
  const handleEditMessage = async (messageId: string, newContent: string) => {
    const { error } = await supabase
      .from('support_messages')
      .update({ content: newContent })
      .eq('id', messageId);

    if (error) {
      toast({ title: 'Erreur', description: 'Impossible de modifier le message', variant: 'destructive' });
      return;
    }

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent } : m));
  };

  const handleCloseConversation = async () => {
    if (!selectedConversation) return;

    const { error } = await supabase
      .from('support_conversations')
      .update({ status: 'closed' })
      .eq('id', selectedConversation.id);

    if (error) {
      toast({ title: 'Erreur', description: 'Impossible de fermer la conversation', variant: 'destructive' });
      return;
    }

    toast({ title: 'Conversation fermée', description: 'La conversation a été marquée comme résolue' });
    setSelectedConversation(null);
    setConversations((prev) => prev.map((c) => c.id === selectedConversation.id ? { ...c, status: 'closed' } : c));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-auto lg:h-[600px]">
      {/* Conversations List */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" />
            Conversations
          </CardTitle>
          <CardDescription>
            {conversations.filter((c) => c.status === 'open').length} conversation(s) ouverte(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[280px] lg:h-[480px]">
            {conversations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 px-4">
                Aucune conversation
              </p>
            ) : (
              <div className="divide-y">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => { setSelectedConversation(conv); setReplyingToId(null); }}
                    className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">{conv.user_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">{conv.user_email}</p>
                        {conv.last_message && (
                          <p className="text-xs text-muted-foreground truncate mt-1">{conv.last_message}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={conv.status === 'open' ? 'default' : 'secondary'} className="text-xs">
                          {conv.status === 'open' ? <Clock className="h-3 w-3 mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                          {conv.status === 'open' ? 'Ouvert' : 'Fermé'}
                        </Badge>
                        {conv.unread_count && conv.unread_count > 0 && (
                          <Badge variant="destructive" className="text-xs">{conv.unread_count}</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {format(new Date(conv.updated_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="lg:col-span-2 flex flex-col">
        {selectedConversation ? (
          <>
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{selectedConversation.user_name}</CardTitle>
                  <CardDescription>{selectedConversation.user_email}</CardDescription>
                </div>
                {selectedConversation.status === 'open' && (
                  <Button variant="outline" size="sm" onClick={handleCloseConversation}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marquer résolu
                  </Button>
                )}
              </div>
            </CardHeader>
            <Separator />
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun message dans cette conversation
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id}>
                      <ChatMessage
                        content={msg.content}
                        isAdmin={msg.is_admin}
                        isOwn={msg.is_admin}
                        createdAt={msg.created_at}
                        deviceInfo={msg.device_info as any}
                        isAdminView={true}
                        messageId={msg.id}
                        onEdit={handleEditMessage}
                      />
                      {/* Re-reply button on admin messages */}
                      {msg.is_admin && (
                        <div className="flex justify-start mt-1 ml-1">
                          {replyingToId === msg.id ? (
                            <div className="w-full max-w-[80%] space-y-2 mt-1">
                              <Textarea
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="Réécrire une seconde réponse..."
                                className="min-h-[60px] text-sm"
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setReplyingToId(null); setReplyContent(''); }}>
                                  Annuler
                                </Button>
                                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleReReply} disabled={replyingSending || !replyContent.trim()}>
                                  {replyingSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                  Envoyer
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setReplyingToId(msg.id); setReplyContent(''); }}
                              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100"
                              style={{ opacity: 0.4 }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.4'; }}
                            >
                              <Reply className="h-3 w-3" />
                              Ré-répondre
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            {selectedConversation.status === 'open' && (
              <>
                <Separator />
                <div className="p-4 shrink-0">
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Répondre au client..."
                      disabled={sending}
                      className="flex-1"
                    />
                    <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                    La signature « L'équipe de Crawlers. » est ajoutée automatiquement.
                  </p>
                </div>
              </>
            )}
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Sélectionnez une conversation</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
