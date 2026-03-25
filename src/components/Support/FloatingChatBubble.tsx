import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { CrawlersLogo } from './CrawlersLogo';
import { isOnboardingDone } from '@/utils/felixOnboarding';
import { playNotificationSound } from '@/utils/notificationSound';

// Lazy load the chat window (heavy component with forms and messages)
const ChatWindow = lazy(() => import('./ChatWindow').then(m => ({ default: m.ChatWindow })));

export function FloatingChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { isAgencyPro } = useCredits();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showOnboardingPulse, setShowOnboardingPulse] = useState(false);
  const [notifDismissedThisSession, setNotifDismissedThisSession] = useState(false);
  const [triggerOnboarding, setTriggerOnboarding] = useState(false);
  const onboardingSoundPlayed = useRef(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  // Show notification only every 3 visits, not if dismissed this session
  useEffect(() => {
    if (!user || isOnboardingDone() || notifDismissedThisSession) {
      setShowOnboardingPulse(false);
      return;
    }
    // Track visit count
    const key = 'felix_notif_visit_count';
    const count = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, String(count));
    // Show only every 3 visits (1st, 4th, 7th…)
    if (count % 3 !== 1) {
      setShowOnboardingPulse(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowOnboardingPulse(true);
      if (!onboardingSoundPlayed.current) {
        playNotificationSound();
        onboardingSoundPlayed.current = true;
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [user, notifDismissedThisSession]);

  // Fetch unread messages count + resolved bug notifications
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      let total = 0;

      // Check support messages
      const { data: conv } = await supabase
        .from('support_conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (conv) {
        const { count } = await supabase
          .from('support_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('is_admin', true)
          .is('read_at', null);
        total += count || 0;
      }

      // Check resolved bug reports not yet notified
      const { count: bugCount } = await supabase
        .from('user_bug_reports')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'resolved')
        .eq('notified_user', false);
      total += bugCount || 0;

      setUnreadCount(total);
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
    const shouldOnboard = showOnboardingPulse;
    setIsOpen(true);
    setShowOnboardingPulse(false);
    if (shouldOnboard) {
      setTriggerOnboarding(true);
    }
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

  // Hide on mobile and on /cocoon (cocoon has its own assistant)
  if (isMobile || location.pathname.startsWith('/app/cocoon')) return null;

  return (
    <>
      {/* Chat Window - lazy loaded */}
      {isOpen && (
        <Suspense fallback={
          <div className="fixed bottom-20 right-4 z-50 w-80 h-96 rounded-lg bg-card border shadow-xl flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        }>
          <ChatWindow
            onClose={() => { setIsOpen(false); setTriggerOnboarding(false); }}
            triggerOnboarding={triggerOnboarding}
            onOnboardingConsumed={() => setTriggerOnboarding(false)}
          />
        </Suspense>
      )}

      {/* Onboarding tooltip */}
      {showOnboardingPulse && !isOpen && (
        <div
          className="fixed bottom-[72px] right-5 z-50 max-w-[220px] rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-medium shadow-lg animate-bounce cursor-pointer group"
          onClick={handleOpen}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowOnboardingPulse(false); setNotifDismissedThisSession(true); }}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/80 text-[10px] font-bold"
            aria-label="Fermer"
          >
            ✕
          </button>
          👋 Bonjour, moi c'est Félix ! Veux-tu que je t'explique comment fonctionne Crawlers ?
          <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-primary rotate-45" />
        </div>
      )}

      {/* Floating Button — Crawlers robot logo */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className="fixed bottom-5 right-5 z-50 h-11 w-11 rounded-full flex items-center justify-center transition-all duration-300 bg-[#7c3aed] hover:scale-105 focus:outline-none overflow-hidden"
        aria-label={isOpen ? 'Fermer le chat' : 'Ouvrir le chat support'}
      >
        <CrawlersLogo size={44} className="opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
      </button>
      {/* Notification Badge — outside button to avoid overflow clipping */}
      {(unreadCount > 0 || showOnboardingPulse) && !isOpen && (
        <span className="fixed bottom-[54px] right-[14px] z-[51] flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold animate-pulse pointer-events-none">
          {showOnboardingPulse ? '!' : unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </>
  );
}
