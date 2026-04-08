import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function ShortLinkRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolve = async () => {
      if (!code) return;
      try {
        const { data, error } = await supabase.functions.invoke('share-actions', {
          body: { action: 'resolve-short', code },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Invalid link');
        
        // targetUrl is like /temporarylink/ABC1234
        const targetUrl = data.targetUrl as string;
        navigate(targetUrl, { replace: true });
      } catch (e: any) {
        console.error('Short link resolve error:', e);
        setError(e?.message || 'Lien invalide ou expiré');
      }
    };
    resolve();
  }, [code, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive text-lg font-medium">{error}</p>
          <a href="/" className="text-primary underline">Retour à l'accueil</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-muted-foreground">Redirection…</span>
      </div>
    </div>
  );
}
