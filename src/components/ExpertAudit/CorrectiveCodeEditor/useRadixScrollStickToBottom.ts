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

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || !enabled) return;

    const viewport = root.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    );
    if (!viewport) return;

    const apply = () => {
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
        apply();
        rafRef.current = requestAnimationFrame(apply);
      });
    };

    schedule();
    const t1 = window.setTimeout(apply, 50);
    const t2 = window.setTimeout(apply, 250);
    const t3 = window.setTimeout(apply, 700);

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

    return () => {
      viewport.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      mo.disconnect();

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [containerRef, enabled]);
}
