import { useState, useEffect } from 'react';
import { Copy, Check, Eye, EyeOff, Cable, Plug, Link2, Loader2, Code, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

const translations = {
  fr: {
    title: 'Intégration Site',
    description: 'Connectez votre site à Crawlers.AI pour appliquer automatiquement les correctifs via le plugin WordPress ou le widget GTM.',
    apiKeyLabel: 'Clé API',
    show: 'Afficher',
    hide: 'Masquer',
    copied: 'Clé API copiée !',
    instructions: 'Cette clé est utilisée par le plugin WordPress et le snippet GTM pour authentifier votre site.',
    magicLink: 'Gérer mes sites',
    magicLinkDesc: 'Branchez et gérez vos intégrations (WordPress, GTM, Script) depuis Mon Espace → Mes Sites.',
    wpMethod: 'Plugin WordPress — synchronisation automatique toutes les 6h.',
    gtmMethod: 'Snippet GTM / Script — widget léger (~2 Ko), compatible tous CMS.',
  },
  en: {
    title: 'Site Integration',
    description: 'Connect your site to Crawlers.AI to automatically apply fixes via the WordPress plugin or GTM widget.',
    apiKeyLabel: 'API Key',
    show: 'Show',
    hide: 'Hide',
    copied: 'API Key copied!',
    instructions: 'This key is used by the WordPress plugin and GTM snippet to authenticate your site.',
    magicLink: 'Manage my sites',
    magicLinkDesc: 'Connect and manage your integrations (WordPress, GTM, Script) from My Account → My Sites.',
    wpMethod: 'WordPress Plugin — automatic sync every 6h.',
    gtmMethod: 'GTM / Script snippet — lightweight widget (~2 KB), all CMS compatible.',
  },
  es: {
    title: 'Integración de sitio',
    description: 'Conecte su sitio a Crawlers.AI para aplicar correcciones automáticamente vía el plugin WordPress o el widget GTM.',
    apiKeyLabel: 'Clave API',
    show: 'Mostrar',
    hide: 'Ocultar',
    copied: '¡Clave API copiada!',
    instructions: 'Esta clave es utilizada por el plugin WordPress y el snippet GTM para autenticar su sitio.',
    magicLink: 'Gestionar mis sitios',
    magicLinkDesc: 'Conecte y gestione sus integraciones (WordPress, GTM, Script) desde Mi Cuenta → Mis Sitios.',
    wpMethod: 'Plugin WordPress — sincronización automática cada 6h.',
    gtmMethod: 'Snippet GTM / Script — widget ligero (~2 KB), compatible con todos los CMS.',
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
          <Cable className="h-5 w-5 text-primary" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Integration methods summary */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-start gap-2 p-2.5 rounded-md border border-dashed bg-muted/30">
            <Plug className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">{t.wpMethod}</p>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-md border border-dashed bg-muted/30">
            <Code className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground">{t.gtmMethod}</p>
          </div>
        </div>

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
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t.instructions}</p>
        </div>

        {/* Link to My Sites */}
        <Button
          variant="secondary"
          className="w-full gap-2"
          onClick={() => {
            const el = document.querySelector('[data-tab="tracking"]') as HTMLButtonElement;
            if (el) el.click();
          }}
        >
          <Cable className="h-4 w-4" />
          {t.magicLink}
        </Button>
        <p className="text-xs text-muted-foreground">{t.magicLinkDesc}</p>
      </CardContent>
    </Card>
  );
}
