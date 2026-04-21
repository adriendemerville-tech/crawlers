/**
 * SocialConnectModal — Modal for connecting social media accounts (LinkedIn, Facebook, Instagram).
 * Supports both OAuth flow (when configured) and manual token entry as fallback.
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Linkedin, Facebook, Instagram, CheckCircle2, AlertCircle, Loader2, ExternalLink, Shield, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SocialAccount {
  platform: 'linkedin' | 'facebook' | 'instagram';
  label: string;
  icon: typeof Linkedin;
  connected: boolean;
  accountName?: string;
  pageId?: string;
  expiresAt?: string;
}

interface SocialConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedSiteId?: string;
}

const PLATFORMS: Omit<SocialAccount, 'connected'>[] = [
  { platform: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { platform: 'facebook', label: 'Facebook', icon: Facebook },
  { platform: 'instagram', label: 'Instagram', icon: Instagram },
];

export function SocialConnectModal({ open, onOpenChange, trackedSiteId }: SocialConnectModalProps) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>(
    PLATFORMS.map(p => ({ ...p, connected: false }))
  );
  const [loading, setLoading] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [manualPageId, setManualPageId] = useState('');

  // Check for OAuth callback results in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('oauth_success');
    const error = params.get('oauth_error');
    if (success) {
      toast.success(`${success} connecté avec succès`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (error) {
      toast.error(`Erreur OAuth : ${error}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load existing connections
  useEffect(() => {
    if (!open || !user) return;
    const load = async () => {
      const { data } = await supabase
        .from('social_accounts' as any)
        .select('platform, page_id, account_name, status, token_expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (data && (data as any[]).length > 0) {
        setAccounts(prev => prev.map(acc => {
          const match = (data as any[]).find((d: any) => d.platform === acc.platform);
          if (match) {
            return {
              ...acc,
              connected: true,
              accountName: match.account_name || match.page_id,
              pageId: match.page_id,
              expiresAt: match.token_expires_at,
            };
          }
          return { ...acc, connected: false, accountName: undefined, pageId: undefined };
        }));
      }
    };
    load();
  }, [open, user]);

  const handleOAuthConnect = async (platform: string) => {
    setLoading(platform);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Session expirée, reconnectez-vous'); return; }

      const { data, error } = await supabase.functions.invoke('social-oauth-init', {
        body: { platform, tracked_site_id: trackedSiteId },
      });

      if (error) throw error;
      if (data?.error) {
        // OAuth not configured — fallback to manual
        if (data.error.includes('not configured')) {
          setManualMode(platform);
          toast.info('OAuth non configuré — utilisez le mode manuel');
          return;
        }
        throw new Error(data.error);
      }

      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (e: any) {
      console.error('[SocialConnect] OAuth error:', e);
      // Fallback to manual mode
      setManualMode(platform);
      toast.info('Connexion OAuth indisponible — mode manuel activé');
    } finally {
      setLoading(null);
    }
  };

  const handleManualSave = async (platform: string) => {
    if (!user || !manualToken || !manualPageId) {
      toast.error('Token et Page ID requis');
      return;
    }
    setLoading(platform);
    try {
      const { error } = await supabase
        .from('social_accounts' as any)
        .upsert({
          user_id: user.id,
          platform,
          access_token: manualToken,
          page_id: manualPageId,
          account_name: manualPageId,
          status: 'active',
          tracked_site_id: trackedSiteId || null,
          token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        } as any, { onConflict: 'user_id,platform' });

      if (error) throw error;

      setAccounts(prev => prev.map(a =>
        a.platform === platform ? { ...a, connected: true, accountName: manualPageId, pageId: manualPageId } : a
      ));
      setManualMode(null);
      setManualToken('');
      setManualPageId('');
      toast.success(`${platform} connecté avec succès`);
    } catch (e: any) {
      toast.error(`Erreur : ${e.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (!user) return;
    setLoading(platform);
    try {
      await supabase
        .from('social_accounts' as any)
        .update({ status: 'revoked' } as any)
        .eq('user_id', user.id)
        .eq('platform', platform);

      setAccounts(prev => prev.map(a =>
        a.platform === platform ? { ...a, connected: false, accountName: undefined, pageId: undefined } : a
      ));
      toast.success(`${platform} déconnecté`);
    } catch {
      toast.error('Erreur lors de la déconnexion');
    } finally {
      setLoading(null);
    }
  };

  const getOAuthUrl = (platform: string) => {
    if (platform === 'linkedin') return 'https://www.linkedin.com/developers/apps';
    if (platform === 'facebook' || platform === 'instagram') return 'https://developers.facebook.com/apps';
    return '#';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Connexion réseaux sociaux
          </DialogTitle>
          <DialogDescription>
            Connectez vos comptes pour publier directement depuis Crawlers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {accounts.map(acc => {
            const Icon = acc.icon;
            const isManual = manualMode === acc.platform;
            const isLoading = loading === acc.platform;

            return (
              <div key={acc.platform} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${acc.connected ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Icon className={`h-5 w-5 ${acc.connected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <span className="font-semibold text-sm">{acc.label}</span>
                      {acc.connected && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Connecté
                          </Badge>
                          {acc.accountName && (
                            <span className="text-[10px] text-muted-foreground">{acc.accountName}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {acc.connected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(acc.platform)}
                        disabled={isLoading}
                        className="text-xs"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Déconnecter'}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOAuthConnect(acc.platform)}
                          disabled={isLoading}
                          className="text-xs gap-1.5"
                        >
                          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Connecter'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setManualMode(isManual ? null : acc.platform)}
                          className="text-xs px-2"
                          title="Configuration manuelle"
                        >
                          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual token input */}
                {isManual && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">Configuration manuelle</p>
                      <p>
                        Générez un token d'accès depuis la console développeur, puis collez-le ci-dessous.
                      </p>
                      <a
                        href={getOAuthUrl(acc.platform)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                      >
                        Ouvrir la console {acc.label} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Access Token</Label>
                        <Input
                          type="password"
                          value={manualToken}
                          onChange={e => setManualToken(e.target.value)}
                          placeholder="Collez votre access token..."
                          className="text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          {acc.platform === 'linkedin' ? 'Organization ID' : acc.platform === 'instagram' ? 'Instagram Business Account ID' : 'Page ID'}
                        </Label>
                        <Input
                          value={manualPageId}
                          onChange={e => setManualPageId(e.target.value)}
                          placeholder={acc.platform === 'linkedin' ? 'Ex: 12345678' : 'Ex: 102938475'}
                          className="text-xs mt-1"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setManualMode(null); setManualToken(''); setManualPageId(''); }} className="text-xs">
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleManualSave(acc.platform)}
                        disabled={!manualToken || !manualPageId || isLoading}
                        className="text-xs gap-1.5 border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Enregistrer'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="text-[11px] text-muted-foreground space-y-1">
          <p className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 shrink-0" />
            Le bouton « Connecter » lance le flux OAuth. Si non configuré, le mode manuel s'active automatiquement.
          </p>
          <p>
            Les tokens manuels expirent après 60 jours. L'OAuth automatique les renouvelle.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
