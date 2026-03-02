import { useState, useEffect } from 'react';
import { Copy, Check, Eye, EyeOff, Download, Plug } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const translations = {
  fr: {
    title: 'Intégration WordPress',
    description: 'Connectez votre site WordPress à Crawlers.AI pour appliquer automatiquement les correctifs.',
    apiKeyLabel: 'Clé API',
    show: 'Afficher',
    hide: 'Masquer',
    copied: 'Clé API copiée !',
    downloadPlugin: 'Télécharger le Plugin WordPress',
    comingSoon: 'Bientôt disponible',
    instructions: 'Copiez cette clé et collez-la dans les paramètres du plugin WordPress Crawlers.AI.',
  },
  en: {
    title: 'WordPress Integration',
    description: 'Connect your WordPress site to Crawlers.AI to automatically apply fixes.',
    apiKeyLabel: 'API Key',
    show: 'Show',
    hide: 'Hide',
    copied: 'API Key copied!',
    downloadPlugin: 'Download WordPress Plugin',
    comingSoon: 'Coming soon',
    instructions: 'Copy this key and paste it into the Crawlers.AI WordPress plugin settings.',
  },
  es: {
    title: 'Integración WordPress',
    description: 'Conecte su sitio WordPress a Crawlers.AI para aplicar correcciones automáticamente.',
    apiKeyLabel: 'Clave API',
    show: 'Mostrar',
    hide: 'Ocultar',
    copied: '¡Clave API copiada!',
    downloadPlugin: 'Descargar Plugin WordPress',
    comingSoon: 'Próximamente',
    instructions: 'Copie esta clave y péguela en la configuración del plugin WordPress Crawlers.AI.',
  },
};

export function WordPressIntegrationCard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) fetchApiKey();
  }, [user]);

  const fetchApiKey = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('api_key')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data?.api_key) {
      setApiKey(data.api_key);
    }
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const maskedKey = apiKey ? apiKey.slice(0, 8) + '••••••••••••••••••••' : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t.apiKeyLabel}</label>
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={visible ? (apiKey || '') : maskedKey}
                className="font-mono text-sm bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => setVisible(!visible)}
                aria-label={visible ? t.hide : t.show}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleCopy}
                aria-label="Copy"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t.instructions}</p>
        </div>

        {/* Download Plugin Button */}
        <Button variant="outline" className="w-full gap-2" disabled>
          <Download className="h-4 w-4" />
          {t.downloadPlugin}
          <span className="text-xs text-muted-foreground ml-1">({t.comingSoon})</span>
        </Button>
      </CardContent>
    </Card>
  );
}
