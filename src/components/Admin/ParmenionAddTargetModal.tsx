import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

const PLATFORMS = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'iktracker', label: 'IKTracker' },
  { value: 'dictadevi', label: 'DictaDevi' },
  { value: 'drupal', label: 'Drupal' },
  { value: 'prestashop', label: 'PrestaShop' },
  { value: 'custom', label: 'Autre / Custom API' },
];

export function ParmenionAddTargetModal({ open, onOpenChange, onAdded }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState('');
  const [label, setLabel] = useState('');
  const [platform, setPlatform] = useState('custom');
  const [apiKeyName, setApiKeyName] = useState('');

  const handleSubmit = async () => {
    if (!domain.trim() || !label.trim()) {
      toast({ title: 'Champs requis', description: 'Domaine et libellé sont obligatoires.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const eventType = `cms_action:${cleanDomain.replace(/\./g, '_')}`;

      // Récupérer l'admin courant pour l'enregistrer comme créateur
      // → déclenche l'auto-rattachement du site dans "Mes Sites" + création de cms_connections
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('parmenion_targets').insert({
        domain: cleanDomain,
        label: label.trim(),
        platform,
        event_type: eventType,
        api_key_name: apiKeyName.trim() || null,
        created_by_user_id: user?.id ?? null,
      });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Domaine existant', description: 'Ce domaine est déjà configuré.', variant: 'destructive' });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: 'Site ajouté', description: `${label.trim()} (${cleanDomain}) a été ajouté comme cible Parménion.` });
      setDomain('');
      setLabel('');
      setPlatform('custom');
      setApiKeyName('');
      onOpenChange(false);
      onAdded();
    } catch (e: any) {
      console.error('Error adding target:', e);
      toast({ title: 'Erreur', description: e.message || 'Impossible d\'ajouter le site.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un site cible</DialogTitle>
          <DialogDescription>
            Configurez un nouveau site pour le pilotage automatique par Parménion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="target-domain">Domaine</Label>
            <Input
              id="target-domain"
              placeholder="exemple.fr"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-label">Libellé (affiché dans l'onglet)</Label>
            <Input
              id="target-label"
              placeholder="Mon Site"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Plateforme CMS</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-apikey">Nom du secret API (optionnel)</Label>
            <Input
              id="target-apikey"
              placeholder="DICTADEVI_API_KEY"
              value={apiKeyName}
              onChange={(e) => setApiKeyName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Nom de la variable d'environnement contenant la clé API du site distant.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Ajout...' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
