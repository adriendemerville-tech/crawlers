/**
 * Silent Error Logger — replaces .catch(() => {}) with centralized logging.
 * Logs to analytics_events with event_type 'silent_error' for admin visibility.
 * Non-blocking: never throws, never impacts user flow.
 */
import { getServiceClient } from './supabaseClient.ts';

export async function logSilentError(
  functionName: string,
  operation: string,
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const supabase = getServiceClient();
    await supabase.from('analytics_events').insert({
      event_type: 'silent_error',
      event_data: {
        function_name: functionName,
        operation,
        error_message: errorMessage,
        severity: context?.severity || 'low',
        impact: context?.impact || 'none',
        ...context,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Last resort: console only — we can't let logging itself crash anything
    console.error(`[silent-error] ${functionName}/${operation}: ${error}`);
  }
}

/**
 * Wraps a fire-and-forget promise with silent error logging instead of .catch(() => {}).
 * Usage: fireAndLog(somePromise, 'crawl-site', 'trigger-worker')
 */
export function fireAndLog(
  promise: Promise<unknown>,
  functionName: string,
  operation: string,
  context?: Record<string, unknown>,
): void {
  promise.catch((err) => logSilentError(functionName, operation, err, context));
}
