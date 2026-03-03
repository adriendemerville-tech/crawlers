import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function SharedReportRedirect() {
  const { shareId } = useParams();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

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
        const signedUrl = data.signedUrl as string;
        window.location.replace(signedUrl);
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
