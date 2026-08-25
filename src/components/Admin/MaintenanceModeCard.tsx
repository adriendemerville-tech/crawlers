import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wrench, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getMaintenanceState,
  invalidateMaintenanceCache,
  parseMaintenancePaths,
} from '@/lib/config/maintenance';

export function MaintenanceModeCard({ readOnly = false }: { readOnly?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(false);
  const [scope, setScope] = useState<'all' | 'paths'>('all');
  const [pathsText, setPathsText] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    invalidateMaintenanceCache();
    getMaintenanceState()
      .then((s) => {
        setActive(s.active);
        setScope(s.scope);
        setPathsText(s.paths.join('\n'));
        setMessage(s.message ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async (next?: { active?: boolean; scope?: 'all' | 'paths' }) => {
    const payload = {
      id: true,
      active: next?.active ?? active,
      scope: next?.scope ?? scope,
      paths: parseMaintenancePaths(pathsText),
      message: message.trim() || null,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_maintenance')
        .upsert(payload as never, { onConflict: 'id' });
      if (error) throw error;

      invalidateMaintenanceCache();
      setPathsText(payload.paths.join('\n'));
      toast.success(
        payload.active
          ? payload.scope === 'all'
            ? 'Maintenance activée sur tout le site'
            : `Maintenance activée sur ${payload.paths.length} chemin(s)`
          : 'Maintenance désactivée'
      );
    } catch (err) {
      console.error('Erreur maintenance:', err);
      toast.error('Enregistrement impossible');
      invalidateMaintenanceCache();
      const fresh = await getMaintenanceState();
      setActive(fresh.active);
      setScope(fresh.scope);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const disabled = readOnly || saving;

  return (
    <Card className={active ? 'border-2 border-amber-500' : 'border-2 border-border'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className={`w-5 h-5 ${active ? 'text-amber-500' : 'text-muted-foreground'}`} />
          Mode maintenance
          {active && (
            <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
              ACTIF
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">
          Redirige les visiteurs vers la page « En maintenance ». Les administrateurs continuent de
          voir le site normalement.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <Label className="text-sm font-medium">Activer la maintenance</Label>
            <p className="text-xs text-muted-foreground">
              Prend effet immédiatement pour les visiteurs.
            </p>
          </div>
          <Switch
            checked={active}
            disabled={disabled}
            onCheckedChange={(checked) => {
              setActive(checked);
              void save({ active: checked });
            }}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Portée</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className={`bg-transparent hover:bg-transparent ${scope === 'all' ? 'border-amber-500' : ''}`}
              onClick={() => {
                setScope('all');
                void save({ scope: 'all' });
              }}
            >
              Tout le site
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className={`bg-transparent hover:bg-transparent ${scope === 'paths' ? 'border-amber-500' : ''}`}
              onClick={() => {
                setScope('paths');
                void save({ scope: 'paths' });
              }}
            >
              Pages ou répertoires choisis
            </Button>
          </div>
        </div>

        {scope === 'paths' && (
          <div className="space-y-2">
            <Label htmlFor="maintenance-paths" className="text-sm font-medium">
              Chemins concernés
            </Label>
            <Textarea
              id="maintenance-paths"
              rows={5}
              value={pathsText}
              disabled={disabled}
              onChange={(e) => setPathsText(e.target.value)}
              placeholder={'/blog\n/app/cocoon\n/tarifs'}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Un chemin par ligne. Un répertoire couvre ses sous-pages : « /blog » inclut
              « /blog/mon-article ». /auth, /admin et /maintenance restent toujours accessibles.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="maintenance-message" className="text-sm font-medium">
            Message affiché (optionnel)
          </Label>
          <Input
            id="maintenance-message"
            value={message}
            disabled={disabled}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mise à jour en cours, retour prévu à 18h."
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => void save()}
            className="bg-transparent hover:bg-transparent"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
          <a
            href="/maintenance"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline"
          >
            Prévisualiser la page
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
