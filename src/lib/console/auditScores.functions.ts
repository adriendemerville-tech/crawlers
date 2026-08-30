import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { fetchConsoleAuditScores } from './auditScores.server';

export const getConsoleAuditScores = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ domain: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    return fetchConsoleAuditScores(context.supabase, data.domain);
  });
