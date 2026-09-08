import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Options de lentilles de ciblage Parménion pour un domaine.
 * Réservé aux administrateurs : la vérification du rôle se fait via le client
 * utilisateur (RLS) avant toute lecture privilégiée.
 */
export const getParmenionLensOptions = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { domain: string }) => {
    const domain = (input?.domain || '').trim();
    if (!domain) throw new Error('domain requis');
    return { domain };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc('has_role', {
      _user_id: context.userId,
      _role: 'admin',
    });
    if (roleError) throw new Error(roleError.message);
    if (!isAdmin) throw new Error('Accès réservé aux administrateurs');

    const [{ supabaseAdmin }, { computeLensOptions }] = await Promise.all([
      import('@/integrations/supabase/client.server'),
      import('./lensOptions.server'),
    ]);

    return await computeLensOptions(supabaseAdmin, data.domain);
  });
