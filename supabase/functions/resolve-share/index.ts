import { getServiceClient } from '../_shared/supabaseClient.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shareId } = await req.json();

    if (!shareId || typeof shareId !== 'string' || shareId.length !== 7) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid share ID' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = getServiceClient();

    const fileName = `reports/${shareId}.html`;

    // Generate a signed URL valid for 7 days
    const { data: urlData, error } = await supabase.storage
      .from('shared-reports')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

    if (error || !urlData?.signedUrl) {
      console.error('Failed to resolve share:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Report not found or expired' }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Resolved shareId ${shareId} to signed URL`);

    return new Response(
      JSON.stringify({ success: true, signedUrl: urlData.signedUrl }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in resolve-share function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
