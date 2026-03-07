import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Radar, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Globe, Puzzle, Palette, ShoppingCart, Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WpSignal {
  id: string;
  label: string;
  found: boolean;
  detail?: string;
}

interface ScanResult {
  url: string;
  isWordPress: boolean;
  confidenceScore: number;
  signalsDetected: number;
  signalsTotal: number;
  signals: WpSignal[];
  wpVersion: string | null;
  detectedTheme: string | null;
  detectedPlugins: string[];
  scannedAt: string;
}

export function WordPressScanner() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('scan-wp', {
        body: { url: url.trim() },
      });

      if (fnError) {
        setError('Erreur de connexion au service de scan.');
        return;
      }

      if (!data?.success) {
        setError(data?.error || 'Erreur inconnue lors du scan.');
        return;
      }

      setResult(data.data);
    } catch {
      setError('Impossible de contacter le service. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  };

  const signalIcon = (id: string) => {
    switch (id) {
      case 'wp_theme': return Palette;
      case 'woocommerce': return ShoppingCart;
      case 'wp_json': return Globe;
      default: return Info;
    }
  };

  return (
    <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
            <Radar className="h-5 w-5 text-violet-500" />
          </div>
          Détecteur WordPress
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Vérifiez si une URL utilise le CMS WordPress
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form */}
        <form onSubmit={handleScan} className="flex gap-2">
          <Input
            type="text"
            placeholder="https://exemple.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 caret-auto"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyse…
              </>
            ) : (
              <>
                <Radar className="h-4 w-4" />
                Scanner
              </>
            )}
          </Button>
        </form>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Main verdict */}
              {result.isWordPress ? (
                <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-base">
                        Ce site est construit sur WordPress
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Confiance : <strong className="text-foreground">{result.confidenceScore}%</strong>
                        {' '}— {result.signalsDetected}/{result.signalsTotal} signaux détectés
                      </p>
                    </div>
                  </div>

                  {/* Extra info */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {result.wpVersion && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Globe className="h-3 w-3" />
                        WordPress {result.wpVersion}
                      </Badge>
                    )}
                    {result.detectedTheme && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Palette className="h-3 w-3" />
                        Thème : {result.detectedTheme}
                      </Badge>
                    )}
                    {result.detectedPlugins.length > 0 && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Puzzle className="h-3 w-3" />
                        {result.detectedPlugins.length} plugin(s)
                      </Badge>
                    )}
                  </div>

                  {/* Detected plugins list */}
                  {result.detectedPlugins.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-emerald-500/20">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Plugins détectés :</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.detectedPlugins.map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px] font-mono">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/5 p-5">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-amber-700 dark:text-amber-400 text-base">
                        Aucune trace de WordPress détectée
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Ce site ne semble pas utiliser WordPress comme CMS.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Signal list */}
              <div className="rounded-lg border p-4 bg-card">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Détail des {result.signalsTotal} signaux analysés
                </p>
                <div className="space-y-2">
                  {result.signals.map((signal) => {
                    const IconComp = signalIcon(signal.id);
                    return (
                      <div
                        key={signal.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        {signal.found ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={signal.found ? 'text-foreground' : 'text-muted-foreground/60'}>
                          {signal.label}
                        </span>
                        {signal.found && signal.detail && (
                          <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
                            {signal.detail}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
