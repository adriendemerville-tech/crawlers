import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const DEFAULT_PAYLOAD = `{
  "prompt": "A cinematic shot of a mountain lake at sunrise",
  "duration": 5,
  "aspect_ratio": "16:9"
}`;

export function WaveSpeedPlayground() {
  const [modelId, setModelId] = useState('bytedance/seedance-v1-pro-t2v-480p');
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [predictionId, setPredictionId] = useState('');
  const [status, setStatus] = useState<string>('');
  const [output, setOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const call = async (body: any) => {
    const { data, error } = await supabase.functions.invoke('wavespeed-proxy', { body });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error(JSON.stringify((data as any).error));
    return (data as any).data;
  };

  const submit = async () => {
    setLoading(true); setStatus(''); setOutput(null); setPredictionId('');
    try {
      const parsed = JSON.parse(payload);
      const res = await call({ action: 'submit', model_id: modelId, payload: parsed });
      const id = res?.data?.id ?? res?.id;
      if (!id) throw new Error('Pas d\u2019ID retourn\u00e9');
      setPredictionId(id);
      setStatus('created');
      setPolling(true);
      toast.success(`Prediction ${id.slice(0, 8)}\u2026 lanc\u00e9e`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const checkBalance = async () => {
    try {
      const res = await call({ action: 'balance' });
      toast.success(`Solde: ${JSON.stringify(res?.data ?? res)}`);
    } catch (e: any) { toast.error(e.message); }
  };

  useEffect(() => {
    if (!polling || !predictionId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await call({ action: 'result', prediction_id: predictionId });
        const d = res?.data ?? res;
        if (cancelled) return;
        setStatus(d?.status ?? 'unknown');
        if (d?.status === 'completed' || d?.status === 'succeeded') {
          setOutput(d);
          setPolling(false);
        } else if (d?.status === 'failed') {
          setOutput(d);
          setPolling(false);
          toast.error(`\u00c9chec: ${d?.error ?? 'inconnu'}`);
        }
      } catch (e: any) {
        if (!cancelled) { toast.error(e.message); setPolling(false); }
      }
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [polling, predictionId]);

  const outputs: string[] = output?.outputs ?? output?.output ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>WaveSpeed.ai Playground</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Model ID</Label>
          <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="ex: bytedance/seedance-v1-pro-t2v-480p" />
          <p className="text-xs text-muted-foreground mt-1">
            Ex: <code>wavespeed-ai/wan-2.2/t2v-a14b-480p</code>, <code>bytedance/seedance-v1-pro-t2v-480p</code>, <code>wavespeed-ai/flux-dev</code>
          </p>
        </div>
        <div>
          <Label>Payload JSON</Label>
          <Textarea rows={10} value={payload} onChange={(e) => setPayload(e.target.value)} className="font-mono text-xs" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={submit} disabled={loading || polling}>
            {loading ? 'Envoi\u2026' : 'Lancer la g\u00e9n\u00e9ration'}
          </Button>
          <Button variant="outline" onClick={checkBalance}>V\u00e9rifier le solde</Button>
        </div>

        {predictionId && (
          <div className="border rounded-md p-3 space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Prediction ID :</span> <code>{predictionId}</code>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Statut :</span> <strong>{status}</strong>
              {polling && <span className="ml-2 text-xs text-muted-foreground">(polling toutes les 3s\u2026)</span>}
            </div>
            {outputs && outputs.length > 0 && (
              <div className="space-y-2">
                {outputs.map((url, i) => (
                  <div key={i}>
                    {/\.(mp4|webm|mov)(\?|$)/i.test(url) ? (
                      <video src={url} controls className="max-w-full rounded" />
                    ) : (
                      <img src={url} alt={`output-${i}`} className="max-w-full rounded" />
                    )}
                    <a href={url} target="_blank" rel="noreferrer" className="text-xs underline break-all">{url}</a>
                  </div>
                ))}
              </div>
            )}
            {output && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Voir la r\u00e9ponse compl\u00e8te</summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-64">{JSON.stringify(output, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
