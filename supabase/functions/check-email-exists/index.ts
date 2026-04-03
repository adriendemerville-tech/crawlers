import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return jsonOk({ exists: false });
    }

    const supabase = getServiceClient();

    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.toLowerCase().trim());

    return jsonOk({ exists: (count ?? 0) > 0 });
  } catch (_error) {
    return jsonOk({ exists: false });
  }
}));