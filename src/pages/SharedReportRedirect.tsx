import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function SharedReportRedirect() {
  const { shareId } = useParams();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const run = async () => {
      if (!shareId) return;

      // Track referral click if ref param present
      const ref = searchParams.get('ref');
      if (ref) {
        try {
          await supabase.functions.invoke('track-share-click', {
            body: {
              report_id: shareId,
              referrer_id: ref,
              visitor_ip: await getVisitorIP(),
            },
          });
        } catch (e) {
          console.warn('Share click tracking failed:', e);
        }
      }

      try {
        const { data, error } = await supabase.functions.invoke('resolve-share', {
          body: { shareId },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Invalid link');

        // Fetch the HTML content from the signed URL
        const signedUrl = data.signedUrl as string;
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error('Failed to load report');
        const html = await response.text();
        setHtmlContent(html);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Lien invalide');
      }
    };
    run();
  }, [shareId, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (htmlContent) {
    return (
      <iframe
        ref={iframeRef}
        srcDoc={htmlContent}
        title="Rapport partagé"
        className="w-full min-h-screen border-none"
        style={{ width: '100%', height: '100vh', border: 'none' }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Ouverture du rapport…</span>
      </div>
    </div>
  );
}

async function getVisitorIP(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}
