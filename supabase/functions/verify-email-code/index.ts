import { getServiceClient } from '../_shared/supabaseClient.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return jsonError('Email and code required', 400);
    }

    const supabase = getServiceClient();

    // Find valid code
    const { data: codeRecord, error: fetchError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (fetchError || !codeRecord) {
      return jsonError('Error', 400);
    }

    // Delete the used code
    await supabase.from('verification_codes').delete().eq('id', codeRecord.id);

    // Also clean up any expired codes for this email
    await supabase
      .from('verification_codes')
      .delete()
      .eq('email', email);

    return jsonOk({ success: true });
  } catch (err) {
    console.error('Error:', err);
    return jsonError('Internal error', 500);
  }
}));