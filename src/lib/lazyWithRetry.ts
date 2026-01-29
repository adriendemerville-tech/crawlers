import { lazy, type ComponentType } from "react";

/**
 * Wraps React.lazy() to mitigate intermittent chunk/module load failures (often cache/CDN related).
 * If the dynamic import fails with a known chunk error, we hard-reload once per tab session.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options?: {
    /** key stored in sessionStorage to avoid infinite reload loops */
    retryKey?: string;
  }
) {
  const retryKey = options?.retryKey ?? "__lazy_retry_once";

  return lazy(() =>
    factory().catch((err: any) => {
      const message = String(err?.message ?? err ?? "");
      const isLikelyChunkError =
        /Loading chunk|ChunkLoadError|dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported module/i.test(
          message
        );

      if (isLikelyChunkError) {
        try {
          const alreadyRetried = sessionStorage.getItem(retryKey);
          if (!alreadyRetried) {
            sessionStorage.setItem(retryKey, "1");
            // Reload to pick up fresh HTML + correct asset graph.
            window.location.reload();
          }
        } catch {
          // ignore storage errors (private mode restrictions, etc.)
        }
      }

      throw err;
    })
  );
}
