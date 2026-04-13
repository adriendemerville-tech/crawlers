/**
 * check-email-exists — Always returns { exists: false } to prevent user enumeration.
 * The actual email verification is handled by Supabase Auth flows.
 */
import { handleRequest, jsonOk } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (_req) => {
  // Never reveal whether an email exists — prevents enumeration attacks
  return jsonOk({ exists: false });
}));
