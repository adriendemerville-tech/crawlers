import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, User, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_admin: boolean;
  read_at: string | null;
  created_at: string;
}

interface AdminSupportProps {
  language: 'fr' | 'en' | 'es';
}

const translations = {
  fr: {
    conversations: 'Conversations',
    noConversations: 'Aucune conversation',
    loading: 'Chargement...',
    typeMessage: 'Tapez votre réponse...',
    send: 'Envoyer',
    open: 'Ouvert',
    closed: 'Fermé',
    close: 'Fermer',
    reopen: 'Rouvrir',
    selectConversation: 'Sélectionnez une conversation',
  },
  en: {
    conversations: 'Conversations',
    noConversations: 'No conversations',
    loading: 'Loading...',
    typeMessage: 'Type your reply...',
    send: 'Send',
    open: 'Open',
    closed: 'Closed',
    close: 'Close',
    reopen: 'Reopen',
    selectConversation: 'Select a conversation',
  },
  es: {
    conversations: 'Conversaciones',
    noConversations: 'Sin conversaciones',
    loading: 'Cargando...',
    typeMessage: 'Escribe tu respuesta...',
    send: 'Enviar',
    open: 'Abierto',
    closed: 'Cerrado',
    close: 'Cerrar',
    reopen: 'Reabrir',
    selectConversation: 'Selecciona una conversación',
  },
};

export function AdminSupport({ language }: AdminSupportProps) {
  const t = translations[language];
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    const { data, error } = await supabase
      .from('support_conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
    } else {
      // Fetch user profiles for each conversation
      const conversationsWithUsers = await Promise.all(
        (data || []).map(async (conv) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('user_id', conv.user_id)
            .single();

          return {
            ...conv,
            user_email: profile?.email || '',
            user_name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unknown',
          };
        })
      );
      setConversations(conversationsWithUsers);
    }
    setLoading(false);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data || []);
      // Mark messages as read
      await supabase
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .is('read_at', null)
        .eq('is_admin', false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setSending(true);
    const { error } = await supabase.from('support_messages').insert({
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      content: newMessage.trim(),
      is_admin: true,
    });

    if (error) {
      toast.error('Error sending message');
    } else {
      setNewMessage('');
      fetchMessages(selectedConversation.id);
      // Update conversation updated_at
      await supabase
        .from('support_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);
    }
    setSending(false);
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedConversation) return;

    await supabase
      .from('support_conversations')
      .update({ status })
      .eq('id', selectedConversation.id);

    setSelectedConversation({ ...selectedConversation, status });
    fetchConversations();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-4 h-[600px]">
      {/* Conversations List */}
      <Card className="md:col-span-1">
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t.conversations}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            {conversations.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t.noConversations}</p>
            ) : (
              <div className="divide-y">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{conv.user_name}</p>
                        <p className="text-sm text-muted-foreground truncate">{conv.subject || conv.user_email}</p>
                      </div>
                      <Badge variant={conv.status === 'open' ? 'default' : 'secondary'}>
                        {conv.status === 'open' ? t.open : t.closed}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(conv.updated_at).toLocaleString(language)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="md:col-span-2">
        {selectedConversation ? (
          <>
            <CardHeader className="py-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{selectedConversation.user_name}</CardTitle>
                <p className="text-sm text-muted-foreground">{selectedConversation.subject}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange(selectedConversation.status === 'open' ? 'closed' : 'open')}
              >
                {selectedConversation.status === 'open' ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t.close}
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-1" />
                    {t.reopen}
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[520px]">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.is_admin
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.is_admin ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(msg.created_at).toLocaleTimeString(language)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={t.typeMessage}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            {t.selectConversation}
          </div>
        )}
      </Card>
    </div>
  );
}
