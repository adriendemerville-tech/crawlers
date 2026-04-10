/**
 * Social Hub — Settings tab
 * Manage API connections and social media accounts (LinkedIn, Facebook, Instagram).
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Settings, Linkedin, Facebook, Instagram, Link2, Unlink,
  CheckCircle2, AlertCircle, ExternalLink, Shield, Key, RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SocialConnection {
  platform: 'linkedin' | 'facebook' | 'instagram';
  label: string;
  icon: typeof Linkedin;
  color: string;
  connected: boolean;
  accountName?: string;
  scopes?: string[];
  expiresAt?: string;
}

interface SocialSettingsProps {
  trackedSiteId: string;
  domain: string;
}

export function SocialSettings({ trackedSiteId, domain }: SocialSettingsProps) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<SocialConnection[]>([
    { platform: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-600', connected: false },
    { platform: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500', connected: false },
    { platform: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500', connected: false },
  ]);
  const [autoPublish, setAutoPublish] = useState(false);
  const [defaultHashtags, setDefaultHashtags] = useState('');
  const [loading, setLoading] = useState(true);

  // Load existing social connections
  useEffect(() => {
    if (!user || !trackedSiteId) { setLoading(false); return; }

    const loadConnections = async () => {
      try {
        const { data } = await supabase
          .from('cms_connections')
          .select('*')
          .eq('user_id', user.id)
          .eq('tracked_site_id', trackedSiteId)
          .in('platform', ['linkedin', 'facebook', 'instagram'] as any);

        if (data && data.length > 0) {
          setConnections(prev => prev.map(conn => {
            const match = data.find((d: any) => d.platform === conn.platform);
            if (match) {
              return {
                ...conn,
                connected: match.status === 'active',
                accountName: match.platform_site_id || undefined,
                expiresAt: match.token_expiry || undefined,
              };
            }
            return conn;
          }));
        }
      } catch (e) {
        console.error('Failed to load social connections', e);
      } finally {
        setLoading(false);
      }
    };

    loadConnections();
  }, [user, trackedSiteId]);

  const handleConnect = async (platform: string) => {
    toast.info(`Connexion ${platform} — OAuth en cours de préparation...`, { duration: 3000 });
    // In a real implementation, this would initiate OAuth flow
    // For now, show the intent
    toast('La connexion OAuth pour les réseaux sociaux sera bientôt disponible. Restez connecté !', {
      duration: 5000,
      icon: '🔗',
    });
  };

  const handleDisconnect = async (platform: string) => {
    if (!user || !trackedSiteId) return;
    try {
      await supabase
        .from('cms_connections')
        .delete()
        .eq('user_id', user.id)
        .eq('tracked_site_id', trackedSiteId)
        .eq('platform', platform as any);

      setConnections(prev => prev.map(c =>
        c.platform === platform ? { ...c, connected: false, accountName: undefined } : c
      ));
      toast.success(`${platform} déconnecté`);
    } catch {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  return (
    <div className="space-y-6">
      {/* Social Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-primary" />
            Comptes réseaux sociaux
          </CardTitle>
          <CardDescription>
            Connectez vos comptes pour publier directement depuis Crawlers.fr
            {domain && <span className="text-foreground font-medium"> — {domain}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connections.map((conn) => {
            const Icon = conn.icon;
            return (
              <div
                key={conn.platform}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${conn.connected ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                    <Icon className={`h-5 w-5 ${conn.connected ? conn.color : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{conn.label}</span>
                      {conn.connected ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400 gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Connecté
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                          <AlertCircle className="h-2.5 w-2.5" /> Non connecté
                        </Badge>
                      )}
                    </div>
                    {conn.accountName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{conn.accountName}</p>
                    )}
                    {conn.expiresAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Token expire : {new Date(conn.expiresAt).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {conn.connected ? (
                    <>
                      <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => handleConnect(conn.platform)}>
                        <RefreshCw className="h-3 w-3" /> Reconnecter
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive gap-1" onClick={() => handleDisconnect(conn.platform)}>
                        <Unlink className="h-3 w-3" /> Déconnecter
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="gap-1.5 text-xs" onClick={() => handleConnect(conn.platform)}>
                      <ExternalLink className="h-3 w-3" /> Connecter
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5 text-primary" />
            Configuration API
          </CardTitle>
          <CardDescription>
            Clés API et tokens pour les intégrations avancées
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Shield className="h-4 w-4 text-emerald-500" />
              Publication via APIs officielles
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Le Social Hub utilise exclusivement les APIs officielles des plateformes :
              LinkedIn Marketing API v2, Meta Graph API (Facebook + Instagram).
              Aucun scraping — vos publications respectent les conditions d'utilisation.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-publish" className="text-sm flex items-center gap-2">
                Publication automatique
                <Badge variant="outline" className="text-[9px]">Pro</Badge>
              </Label>
              <Switch
                id="auto-publish"
                checked={autoPublish}
                onCheckedChange={setAutoPublish}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Active la publication automatique aux horaires planifiés dans le calendrier.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="default-hashtags" className="text-sm">Hashtags par défaut</Label>
            <Input
              id="default-hashtags"
              placeholder="#SEO #GEO #Marketing #Crawlers"
              value={defaultHashtags}
              onChange={(e) => setDefaultHashtags(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Ces hashtags seront ajoutés automatiquement à chaque nouvelle publication.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Permissions & Sécurité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <span>Les tokens OAuth sont chiffrés et stockés de manière sécurisée</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <span>Aucun accès aux messages privés — uniquement publication et statistiques</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <span>Révocation possible à tout moment depuis cette page ou depuis les paramètres de chaque plateforme</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <span>Données sociales isolées par utilisateur (RLS) — jamais partagées avec des tiers</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
