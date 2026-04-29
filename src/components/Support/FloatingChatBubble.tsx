import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useAISidebar } from '@/contexts/AISidebarContext';
import { CrawlersLogo } from './CrawlersLogo';
import { isOnboardingDone } from '@/utils/felixOnboarding';
import { playNotificationSound } from '@/utils/notificationSound';

// Lazy load de l'ancien shell Félix dédié, antérieur à la refactorisation agents.
const ChatWindow = lazy(() => import('./ChatWindow').then(m => ({ default: m.ChatWindow })));

export function FloatingChatBubble() {
  const [isOpen, setIsOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('felix') === 'fullpage';
  });
  const { user } = useAuth();
  const { isAgencyPro } = useCredits();
  const { felixExpanded, cocoonExpanded } = useAISidebar();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showOnboardingPulse, setShowOnboardingPulse] = useState(false);
  const [notifDismissedThisSession, setNotifDismissedThisSession] = useState(false);
  const [triggerOnboarding, setTriggerOnboarding] = useState(false);
  const [showBounce, setShowBounce] = useState(false);
  const [showGuestQuizSuggestion, setShowGuestQuizSuggestion] = useState(false);
  const [autoStartCrawlersQuiz, setAutoStartCrawlersQuiz] = useState(false);
  const [autoEnterpriseContact, setAutoEnterpriseContact] = useState(false);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('felix_muted') === '1');
  const onboardingSoundPlayed = useRef(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const isSilentPage = location.pathname === '/' || location.pathname.startsWith('/blog');
  

  // Hide Félix on report preview/viewer pages
  const hiddenRoutes = ['/app/rapport/', '/temporarylink/', '/temporaryreport/', '/r/'];
  const isReportPage = hiddenRoutes.some(r => location.pathname.startsWith(r));

  // Sync mute state from ChatWindow toggle
  useEffect(() => {
    const handler = () => setIsMuted(localStorage.getItem('felix_muted') === '1');
    window.addEventListener('felix_mute_changed', handler);
    return () => window.removeEventListener('felix_mute_changed', handler);
  }, []);

  // Ping-pong bounce animation on first home visit after 20s
  useEffect(() => {
    if (isMuted) return;
    if (location.pathname !== '/') return;
    const key = 'felix_bounce_played';
    if (sessionStorage.getItem(key)) return;
    const timer = setTimeout(() => {
      sessionStorage.setItem(key, '1');
      setShowBounce(true);
      setTimeout(() => setShowBounce(false), 2000);
    }, 20000);
    return () => clearTimeout(timer);
  }, [location.pathname, isMuted]);

  // Listen for enterprise contact event from pricing pages
  useEffect(() => {
    const handler = () => {
      setAutoEnterpriseContact(true);
      setIsOpen(true);
    };
    window.addEventListener('felix-enterprise-contact', handler);
    return () => window.removeEventListener('felix-enterprise-contact', handler);
  }, []);

  // Listen for "Nous écrire" from Aide page — open Félix with greeting
  const [felixGreeting, setFelixGreeting] = useState<string | null>(null);
  const [felixExpandedGreeting, setFelixExpandedGreeting] = useState<string | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setFelixGreeting(detail?.message || "Que puis-je faire pour t'aider ?");
      setFelixExpandedGreeting(detail?.expandedMessage || null);
      setIsOpen(true);
    };
    window.addEventListener('felix-open-with-message', handler);
    return () => window.removeEventListener('felix-open-with-message', handler);
  }, []);

  // Listen for hallucination diagnosis suggestion (2s after modal close)
  const [showHallucinationBubble, setShowHallucinationBubble] = useState(false);
  useEffect(() => {
    const handler = () => {
      if (isMuted) return;
      setShowHallucinationBubble(true);
      if (!isSilentPage) playNotificationSound();
      // Auto-hide after 15s
      setTimeout(() => setShowHallucinationBubble(false), 15000);
    };
    window.addEventListener('felix-hallucination-diagnosis', handler);
    return () => window.removeEventListener('felix-hallucination-diagnosis', handler);
  }, [isMuted]);

  // Suggest Crawlers quiz to non-logged users on home after 5s
  // Auto-hide the bubble after 10s but keep the notification badge
  const [guestBubbleVisible, setGuestBubbleVisible] = useState(false);
  useEffect(() => {
    if (isMuted) return;
    if (user) return;
    if (location.pathname !== '/') return;
    const key = 'felix_guest_quiz_suggested';
    if (sessionStorage.getItem(key)) return;
    const showTimer = setTimeout(() => {
      sessionStorage.setItem(key, '1');
      setShowGuestQuizSuggestion(true);
      setGuestBubbleVisible(true);
      if (!isSilentPage) playNotificationSound();
      // Auto-hide bubble text after 10s, keep notification dot
      setTimeout(() => setGuestBubbleVisible(false), 10000);
    }, 5000);
    return () => clearTimeout(showTimer);
  }, [user, location.pathname, isMuted]);

  // Show notification only every 3 visits, not if dismissed this session
  useEffect(() => {
    if (isMuted || !user || isOnboardingDone() || notifDismissedThisSession) {
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
        if (!isSilentPage) playNotificationSound();
        onboardingSoundPlayed.current = true;
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [user, notifDismissedThisSession, isMuted]);

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

  // Hide on mobile, /cocoon, /signup, /auth, and report preview pages
  const hiddenPaths = ['/app/cocoon', '/signup', '/auth'];
  if (isMobile || isReportPage || hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

  return (
    <>
      {/* Chat Window legacy dédié — lazy loaded */}
      {isOpen && (
        <Suspense fallback={
          <div className="fixed bottom-20 z-[110] w-80 h-96 rounded-lg bg-card border shadow-xl flex items-center justify-center" style={{ right: 'max(0.25rem, calc((100vw - 72rem) / 2 - 3.5rem))' }}>
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        }>
          <ChatWindow
            onClose={() => { setIsOpen(false); setTriggerOnboarding(false); setAutoStartCrawlersQuiz(false); setAutoEnterpriseContact(false); setFelixGreeting(null); setFelixExpandedGreeting(null); }}
            triggerOnboarding={triggerOnboarding}
            onOnboardingConsumed={() => setTriggerOnboarding(false)}
            autoStartCrawlersQuiz={autoStartCrawlersQuiz}
            autoEnterpriseContact={autoEnterpriseContact}
            initialGreeting={felixGreeting}
            initialExpandedGreeting={felixExpandedGreeting}
          />
        </Suspense>
      )}

      {/* Onboarding tooltip — charte : bordure + texte, pas de fond plein, pas d'émoji */}
      {showOnboardingPulse && !isOpen && (
        <div
          className="fixed bottom-[72px] z-[110] max-w-[220px] rounded-xl border border-primary/40 bg-background/95 backdrop-blur text-foreground px-3 py-2 text-xs font-medium shadow-lg animate-bounce cursor-pointer group"
           style={{ right: 'max(0.25rem, calc((100vw - 72rem) / 2 - 3.5rem))' }}
          onClick={handleOpen}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowOnboardingPulse(false); setNotifDismissedThisSession(true); }}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full border border-border bg-background text-muted-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted text-[10px] font-bold"
            aria-label="Fermer"
          >
            ✕
          </button>
          Bonjour, moi c'est Félix. Veux-tu que je t'explique comment fonctionne Crawlers ?
        </div>
      )}

      {/* Guest quiz suggestion tooltip */}
      {guestBubbleVisible && !isOpen && !showOnboardingPulse && (
        <div
          className="fixed bottom-[72px] z-[110] max-w-[240px] rounded-xl border border-primary/40 bg-background/95 backdrop-blur text-foreground px-3 py-2.5 text-xs font-medium shadow-lg cursor-pointer group"
           style={{ right: 'max(0.25rem, calc((100vw - 72rem) / 2 - 3.5rem))' }}
          onClick={() => { setShowGuestQuizSuggestion(false); setIsOpen(true); }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowGuestQuizSuggestion(false); }}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full border border-border bg-background text-muted-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted text-[10px] font-bold"
            aria-label="Fermer"
          >
            ✕
          </button>
          En quoi puis-je t'être utile&nbsp;?
        </div>
      )}

      {/* Hallucination diagnosis suggestion bubble */}
      {showHallucinationBubble && !isOpen && (
        <div
          className="fixed bottom-[72px] z-[110] max-w-[260px] rounded-xl border border-primary/40 bg-background/95 backdrop-blur text-foreground px-3 py-2.5 text-xs font-medium shadow-lg cursor-pointer group animate-bounce"
          style={{ right: 'max(0.25rem, calc((100vw - 72rem) / 2 - 3.5rem))' }}
          onClick={() => {
            setShowHallucinationBubble(false);
            setIsOpen(true);
            setTimeout(() => window.dispatchEvent(new Event('felix-start-hallucination-diagnosis')), 300);
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowHallucinationBubble(false); }}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full border border-border bg-background text-muted-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted text-[10px] font-bold"
            aria-label="Fermer"
          >
            ✕
          </button>
          Veux-tu que je t'aide à diagnostiquer cette hallucination&nbsp;?
        </div>
      )}

      {/* Floating Button — Crawlers robot logo (hidden when sidebar is expanded) */}
      {!(isOpen && felixExpanded) && !cocoonExpanded && (
        <>
          <button
            onClick={isOpen ? () => setIsOpen(false) : handleOpen}
            className={`fixed bottom-5 z-[110] h-[3.15rem] w-[3.15rem] rounded-full flex items-center justify-center transition-all duration-300 border border-primary/60 bg-background/80 backdrop-blur hover:bg-background hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary overflow-hidden ${showBounce ? 'animate-felix-bounce' : ''}`}
            style={{ right: 'max(0.25rem, calc((100vw - 72rem) / 2 - 3.5rem))' }}
            aria-label={isOpen ? 'Fermer le chat' : 'Ouvrir le chat support'}
          >
            <CrawlersLogo size={56} className="transition-opacity duration-300" />
          </button>
          {/* Notification Badge — outside button to avoid overflow clipping */}
          {(unreadCount > 0 || showOnboardingPulse || showGuestQuizSuggestion || showHallucinationBubble) && !isOpen && (
            <span className="fixed bottom-[54px] z-[111] flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold animate-pulse pointer-events-none" style={{ right: 'max(0.25rem, calc((100vw - 72rem) / 2 - 3rem))' }}>
              {(showOnboardingPulse || showGuestQuizSuggestion) ? '!' : unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </>
      )}
    </>
  );
}
