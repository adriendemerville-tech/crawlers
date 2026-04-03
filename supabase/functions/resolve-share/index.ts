import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleRequest, jsonOk, jsonError } from '../_shared/serveHandler.ts';

Deno.serve(handleRequest(async (req) => {
try {
    const { shareId } = await req.json();

    if (!shareId || typeof shareId !== 'string' || shareId.length !== 7) {
      return jsonOk({ success: false, error: 'Invalid share ID' }, 400);
    }

    const supabase = getServiceClient();

    const fileName = `reports/${shareId}.html`;

    // Generate a signed URL valid for 7 days
    const { data: urlData, error } = await supabase.storage
      .from('shared-reports')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

    if (error || !urlData?.signedUrl) {
      console.error('Failed to resolve share:', error);
      return jsonOk({ success: false, error: 'Report not found or expired' }, 404);
    }

    console.log(`Resolved shareId ${shareId} to signed URL`);

    return jsonOk({ success: true, signedUrl: urlData.signedUrl });
  } catch (error: any) {
    console.error("Error in resolve-share function:", error);
    return jsonOk({ success: false, error: error.message }, 500);
  }
}));