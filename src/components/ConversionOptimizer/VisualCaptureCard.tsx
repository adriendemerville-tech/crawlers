import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Camera, Monitor, Smartphone, Video, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Friction {
  code: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  device: 'desktop' | 'mobile' | 'both';
}

interface Capture {
  id: string;
  page_url: string;
  desktop_screenshot_url: string | null;
  mobile_screenshot_url: string | null;
  video_url: string | null;
  frictions: Friction[];
  friction_score: number | null;
  created_at: string;
}

interface Props {
  trackedSiteId: string;
  pageUrl: string;
}

const severityLabel: Record<Friction['severity'], string> = {
  critical: 'Critique',
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

export function VisualCaptureCard({ trackedSiteId, pageUrl }: Props) {
  const { toast } = useToast();
  const [capturing, setCapturing] = useState(false);
  const [withVideo, setWithVideo] = useState(false);
  const [capture, setCapture] = useState<Capture | null>(null);

  const loadLatest = useCallback(async () => {
    if (!trackedSiteId || !pageUrl) return;
    const { data } = await supabase
      .from('conversion_visual_captures')
      .select('*')
      .eq('tracked_site_id', trackedSiteId)
      .eq('page_url', pageUrl)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setCapture((data as unknown as Capture) ?? null);
  }, [trackedSiteId, pageUrl]);

  useEffect(() => {
    setCapture(null);
    void loadLatest();
  }, [loadLatest]);

  const runCapture = async () => {
    if (!trackedSiteId || !pageUrl) return;
    setCapturing(true);
    try {
      const { data, error } = await supabase.functions.invoke('conversion-visual-capture', {
        body: { tracked_site_id: trackedSiteId, page_url: pageUrl, with_video: withVideo },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await loadLatest();
      toast({
        title: 'Capture visuelle terminée',
        description: `${data?.frictions?.length ?? 0} friction(s) détectée(s) — score ${data?.friction_score ?? '—'}/100`,
      });
    } catch (e) {
      toast({
        title: 'Capture impossible',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setCapturing(false);
    }
  };

  const frictions = Array.isArray(capture?.frictions) ? capture!.frictions : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Preuve visuelle du parcours
            </CardTitle>
            <CardDescription className="text-xs">
              Rendu réel desktop et mobile, frictions mesurées sur les positions exactes des éléments (aucun modèle de langage sollicité).
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={withVideo} onCheckedChange={setWithVideo} />
              Screencast
            </label>
            <Button variant="outline" onClick={runCapture} disabled={!pageUrl || capturing} className="gap-2">
              {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {capturing ? 'Capture...' : 'Capturer'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!capture && !capturing && (
          <p className="text-xs text-muted-foreground">
            Aucune capture pour cette page. Lancez une capture pour voir ce que voit réellement le visiteur.
          </p>
        )}

        {capture && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Score de fluidité</span>
              <Badge variant="outline" className="font-mono">
                {capture.friction_score ?? '—'}/100
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {new Date(capture.created_at).toLocaleString('fr-FR')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capture.desktop_screenshot_url && (
                <figure className="space-y-1.5">
                  <figcaption className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5" /> Desktop (1280 x 720)
                  </figcaption>
                  <img
                    src={capture.desktop_screenshot_url}
                    alt={`Rendu desktop de ${capture.page_url}`}
                    loading="lazy"
                    className="w-full rounded-md border"
                  />
                </figure>
              )}
              {capture.mobile_screenshot_url && (
                <figure className="space-y-1.5">
                  <figcaption className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5" /> Mobile (iPhone 14 Pro)
                  </figcaption>
                  <img
                    src={capture.mobile_screenshot_url}
                    alt={`Rendu mobile de ${capture.page_url}`}
                    loading="lazy"
                    className="w-full max-w-[280px] mx-auto rounded-md border"
                  />
                </figure>
              )}
            </div>

            {capture.video_url && (
              <figure className="space-y-1.5">
                <figcaption className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" /> Parcours filmé
                </figcaption>
                <video src={capture.video_url} controls className="w-full rounded-md border" />
              </figure>
            )}

            {frictions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune friction structurelle détectée sur ce rendu.</p>
            ) : (
              <ul className="space-y-2">
                {frictions.map((f, i) => (
                  <li key={`${f.code}-${f.device}-${i}`} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="text-sm font-medium">{f.title}</span>
                      <Badge variant="outline" className="text-[10px]">{severityLabel[f.severity]}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{f.device}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
