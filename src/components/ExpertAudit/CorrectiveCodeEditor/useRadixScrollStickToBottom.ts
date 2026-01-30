import { useLayoutEffect, useRef } from "react";

type Options = {
  /** A ref to an element that CONTAINS the Radix ScrollArea viewport */
  containerRef: React.RefObject<HTMLElement>;
  /** When true, we force the viewport to stay pinned to bottom */
  enabled: boolean;
};

/**
 * Keeps a Radix ScrollArea viewport pinned to the bottom.
 *
 * Why: in complex modals (animations, content resizing), Radix/reflows can reset
 * scrollTop to 0 *after* the last React state update. Observers keep us pinned.
 */
export function useRadixScrollStickToBottom({ containerRef, enabled }: Options) {
  const rafRef = useRef<number | null>(null);
  const isSettingScrollRef = useRef(false);
  const activeViewportRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || !enabled) return;

    const getViewport = () =>
      root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");

    const apply = (viewport: HTMLElement | null) => {
      if (!viewport) return;
      // Prevent feedback loops with scroll event
      isSettingScrollRef.current = true;
      viewport.scrollTop = viewport.scrollHeight;
      requestAnimationFrame(() => {
        isSettingScrollRef.current = false;
      });
    };

    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const viewport = activeViewportRef.current ?? getViewport();
        apply(viewport);
        rafRef.current = requestAnimationFrame(() => apply(viewport));
      });
    };

    // Bind observers to the current Radix viewport.
    // Important: Radix can recreate the viewport during reflows/animations.
    // If that happens, previous listeners are attached to a dead element and scroll resets to 0.
    let cleanupViewport: (() => void) | null = null;
    const bindViewport = () => {
      const viewport = getViewport();
      if (!viewport) return;
      if (activeViewportRef.current === viewport) return;

      cleanupViewport?.();
      activeViewportRef.current = viewport;

      const onScroll = () => {
        if (isSettingScrollRef.current) return;
        schedule();
      };
      viewport.addEventListener("scroll", onScroll, { passive: true });

      // When the modal reflows (e.g. payment banner appears), keep the viewport pinned.
      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => schedule());
        ro.observe(viewport);
        if (viewport.firstElementChild) ro.observe(viewport.firstElementChild);
      }

      // Catch late DOM mutations / style changes that may happen outside React.
      const mo = new MutationObserver(() => schedule());
      mo.observe(viewport, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true,
      });

      cleanupViewport = () => {
        viewport.removeEventListener("scroll", onScroll);
        ro?.disconnect();
        mo.disconnect();
      };

      // Immediately pin after (re)binding.
      schedule();
    };

    // Initial bind + pin.
    bindViewport();
    schedule();

    // Fallback timeouts (late paints / transitions)
    const t1 = window.setTimeout(() => apply(activeViewportRef.current), 50);
    const t2 = window.setTimeout(() => apply(activeViewportRef.current), 250);
    const t3 = window.setTimeout(() => apply(activeViewportRef.current), 700);

    // Watch for viewport replacement under the container.
    const rootObserver = new MutationObserver(() => bindViewport());
    rootObserver.observe(root, { childList: true, subtree: true });

    return () => {
      rootObserver.disconnect();
      cleanupViewport?.();
      cleanupViewport = null;
      activeViewportRef.current = null;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [containerRef, enabled]);
}
