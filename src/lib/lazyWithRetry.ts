import { lazy } from "react";

/**
 * Wrap React.lazy imports with a one-time retry (hard reload) on chunk/module load failure.
 * This prevents permanent white screens after deployments or transient network issues.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  options?: {
    /** localStorage key used to guard against infinite reload loops */
    guardKey?: string;
  }
) {
  const guardKey = options?.guardKey ?? "lazy_retry_once";

  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const alreadyRetried = localStorage.getItem(guardKey) === "1";

      // Log once so we can see it in console diagnostics.
      // eslint-disable-next-line no-console
      console.error("[lazyWithRetry] Failed to load module", err);

      if (!alreadyRetried) {
        try {
          localStorage.setItem(guardKey, "1");
        } catch {
          // Ignore storage issues; fallback to reload anyway.
        }

        // Hard reload to fetch fresh assets.
        window.location.reload();
      }

      // If we already retried, rethrow so ErrorBoundary can render a fallback UI.
      throw err;
    }
  });
}
