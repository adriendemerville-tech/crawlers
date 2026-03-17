import { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';

// Lazy load the chat window (heavy component with forms and messages)
const ChatWindow = lazy(() => import('./ChatWindow').then(m => ({ default: m.ChatWindow })));

export function FloatingChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { isAgencyPro } = useCredits();
  const [unreadCount, setUnreadCount] = useState(0);
  const isMobile = useIsMobile();
  const location = useLocation();

  // Fetch unread messages count
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      // Get user's open conversation
      const { data: conv } = await supabase
        .from('support_conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (!conv) {
        setUnreadCount(0);
        return;
      }

      // Count unread admin messages
      const { count } = await supabase
        .from('support_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .eq('is_admin', true)
        .is('read_at', null);

      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel('user-unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
        },
        (payload) => {
          // If it's an admin message, increment count
          if (payload.new && (payload.new as any).is_admin) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Reset unread count when opening chat
  const handleOpen = () => {
    setIsOpen(true);
    // Mark messages as read when opening
    if (user && unreadCount > 0) {
      markMessagesAsRead();
    }
  };

  const markMessagesAsRead = async () => {
    if (!user) return;

    const { data: conv } = await supabase
      .from('support_conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .maybeSingle();

    if (conv) {
      await supabase
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conv.id)
        .eq('is_admin', true)
        .is('read_at', null);

      setUnreadCount(0);
    }
  };

  if (isMobile) return null;
  if (location.pathname === '/cocoon') return null;
  if (location.pathname === '/') return null;

  return (
    <>
      {/* Chat Window - lazy loaded */}
      {isOpen && (
        <Suspense fallback={
          <div className="fixed bottom-20 right-4 z-50 w-80 h-96 rounded-lg bg-card border shadow-xl flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        }>
          <ChatWindow onClose={() => setIsOpen(false)} />
        </Suspense>
      )}

      {/* Floating Button */}
      <Button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className={`fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 ${
          isAgencyPro 
            ? '!bg-violet-600 hover:!bg-violet-700 border-0' 
            : ''
        }`}
        size="icon"
        aria-label={isOpen ? 'Fermer le chat' : 'Ouvrir le chat support'}
      >
        <MessageCircle className={`h-6 w-6 ${isAgencyPro ? 'text-yellow-400' : ''}`} style={isAgencyPro ? { filter: 'drop-shadow(0 0 3px rgba(234, 179, 8, 0.5))' } : undefined} />
        {/* Notification Badge */}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    </>
  );
}
