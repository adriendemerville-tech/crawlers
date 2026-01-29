import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function SharedReportRedirect() {
  const { shareId } = useParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!shareId) return;
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
  }, [shareId]);

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
