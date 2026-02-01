import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
}

const translations = {
  fr: {
    support: 'Support',
    typeMessage: 'Écrivez votre message...',
    send: 'Envoyer',
    startConversation: 'Comment pouvons-nous vous aider ?',
    connecting: 'Connexion...',
  },
  en: {
    support: 'Support',
    typeMessage: 'Type your message...',
    send: 'Send',
    startConversation: 'How can we help you?',
    connecting: 'Connecting...',
  },
  es: {
    support: 'Soporte',
    typeMessage: 'Escribe tu mensaje...',
    send: 'Enviar',
    startConversation: '¿Cómo podemos ayudarte?',
    connecting: 'Conectando...',
  },
};

export function SupportChatBubble() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isMobile = useIsMobile();
  const t = translations[language];
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check for existing conversation
  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchConversation = async () => {
      setLoading(true);
      const { data: conversations } = await supabase
        .from('support_conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (conversations && conversations.length > 0) {
        setConversationId(conversations[0].id);
        // Fetch messages
        const { data: msgs } = await supabase
          .from('support_messages')
          .select('id, content, is_admin, created_at')
          .eq('conversation_id', conversations[0].id)
          .order('created_at', { ascending: true });
        setMessages(msgs || []);
      }
      setLoading(false);
    };

    fetchConversation();
  }, [user, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`support-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setSending(true);
    let convId = conversationId;

    // Create conversation if needed
    if (!convId) {
      const { data: newConv, error } = await supabase
        .from('support_conversations')
        .insert([{
          user_id: user.id,
          subject: newMessage.slice(0, 50),
          status: 'open',
        }])
        .select('id')
        .single();

      if (error || !newConv) {
        setSending(false);
        return;
      }
      convId = newConv.id;
      setConversationId(convId);
    }

    // Send message
    const { error } = await supabase.from('support_messages').insert([{
      conversation_id: convId,
      sender_id: user.id,
      content: newMessage.trim(),
      is_admin: false,
    }]);

    if (!error) {
      setNewMessage('');
      // Update conversation
      await supabase
        .from('support_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId);
    }
    setSending(false);
  };

  // Only show on desktop and when user is logged in
  if (!user || isMobile) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-96 h-[500px] bg-background border rounded-lg shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-4">
              <h3 className="font-semibold">{t.support}</h3>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">{t.connecting}</span>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-muted-foreground">{t.startConversation}</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.is_admin
                            ? 'bg-muted'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.is_admin ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                          {new Date(msg.created_at).toLocaleTimeString(language)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t.typeMessage}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                />
                <Button size="icon" onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
