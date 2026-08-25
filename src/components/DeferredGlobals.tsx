import { lazy, Suspense, useEffect, useState } from "react";

const FloatingChatBubble = lazy(() =>
  import("@/components/Support/FloatingChatBubble").then((m) => ({
    default: m.FloatingChatBubble,
  })),
);
const SurveyModal = lazy(() =>
  import("@/components/Survey/SurveyModal").then((m) => ({
    default: m.SurveyModal,
  })),
);
// Les deux toasters, le traceur de pages et le heartbeat de session ne servent
// jamais au premier rendu : leur JS (radix-toast + sonner + analytics) pesait
// pour rien dans le chunk d'entrée mesuré par Lighthouse.
const Toaster = lazy(() =>
  import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })),
);
const Sonner = lazy(() =>
  import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })),
);
const PageViewTracker = lazy(() =>
  import("@/components/Analytics/PageViewTracker").then((m) => ({
    default: m.PageViewTracker,
  })),
);
const SessionHeartbeatManager = lazy(() =>
  import("@/components/SessionHeartbeatManager").then((m) => ({
    default: m.SessionHeartbeatManager,
  })),
);

/**
 * Monte les widgets globaux non critiques (bulle de support, modale d'enquête)
 * seulement après l'hydratation, quand le thread principal est libre.
 * Objectif : sortir leur JS du chemin critique du LCP.
 */
export function DeferredGlobals() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    const activate = () => setReady(true);

    const schedule = () => {
      const ric = (window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }).requestIdleCallback;
      if (ric) {
        idle = ric(activate, { timeout: 4000 });
      } else {
        timer = setTimeout(activate, 2500);
      }
    };

    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, activate, { once: true, passive: true }));

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
    }

    return () => {
      events.forEach((e) => window.removeEventListener(e, activate));
      window.removeEventListener("load", schedule);
      if (timer) clearTimeout(timer);
      const cic = (window as unknown as {
        cancelIdleCallback?: (handle: number) => void;
      }).cancelIdleCallback;
      if (idle !== undefined && cic) cic(idle);
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <Suspense fallback={null}>
      <Toaster />
      <Sonner />
      <PageViewTracker />
      <SessionHeartbeatManager />
      <FloatingChatBubble />
      <SurveyModal />
    </Suspense>
  );
}
