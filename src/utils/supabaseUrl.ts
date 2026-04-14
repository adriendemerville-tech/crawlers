/**
 * Centralized Supabase URL helper.
 * Avoids hardcoding the project ref across the codebase.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/** Base URL for edge functions (e.g. https://xxx.supabase.co/functions/v1) */
export const EDGE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

/** Build a full edge function URL */
export function edgeFunctionUrl(functionName: string): string {
  return `${EDGE_FUNCTIONS_URL}/${functionName}`;
}
