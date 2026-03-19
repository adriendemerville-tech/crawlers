import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChatMessage } from './ChatMessage';
import { useToast } from '@/hooks/use-toast';
import { getDeviceInfo } from '@/utils/deviceInfo';

interface Message {
  id: string;
  content: string;
  is_admin: boolean;
  sender_id: string;
  created_at: string;
}

interface ChatWindowProps {
  onClose: () => void;
}

export function ChatWindow({ onClose }: ChatWindowProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch or create conversation
  useEffect(() => {
    if (!user) return;

    const fetchConversation = async () => {
      // Try to find existing open conversation
      const { data: existing, error: fetchError } = await supabase
        .from('support_conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching conversation:', fetchError);
        setLoading(false);
        return;
      }

      if (existing) {
        setConversationId(existing.id);
      }
      setLoading(false);
    };

    fetchConversation();
  }, [user]);

  // Fetch messages when conversation is found
  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      let currentConversationId = conversationId;

      // Create conversation if it doesn't exist
      if (!currentConversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('support_conversations')
          .insert({
            user_id: user.id,
            subject: 'Nouvelle conversation',
            status: 'open',
          })
          .select('id')
          .single();

        if (convError) throw convError;
        currentConversationId = newConv.id;
        setConversationId(currentConversationId);
      }

      // Send message with device info
      const deviceInfo = getDeviceInfo();
      const { error: msgError } = await supabase
        .from('support_messages')
        .insert({
          conversation_id: currentConversationId,
          sender_id: user.id,
          content: messageContent,
          is_admin: false,
          device_info: deviceInfo as any,
        });

      if (msgError) throw msgError;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erreur',
        description: "Impossible d'envoyer le message",
        variant: 'destructive',
      });
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
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
          <h3 className="font-semibold">Support</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6 text-center text-muted-foreground">
          <p>Connectez-vous pour contacter le support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 rounded-lg border bg-background shadow-xl flex flex-col max-h-[70vh]">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3 shrink-0">
        <h3 className="font-semibold">Support</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-sm">Bonjour ! Comment pouvons-nous vous aider ?</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                content={msg.content}
                isAdmin={msg.is_admin}
                isOwn={msg.sender_id === user.id}
                createdAt={msg.created_at}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3 shrink-0">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez votre message..."
            disabled={sending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            size="icon"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
