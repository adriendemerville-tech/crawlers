import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Activity, Plus, UserPlus, Loader2, Trash2, Globe, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface AgencyClient {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  created_at: string;
}

interface ClientSite {
  id: string;
  tracked_site_id: string;
  domain: string;
  site_name: string;
}

interface TrackedSite {
  id: string;
  domain: string;
  site_name: string;
}

const translations = {
  fr: {
    title: 'Clients',
    description: 'Gérez vos clients et associez-les à vos sites',
    newClient: 'Nouveau client',
    firstName: 'Prénom',
    lastName: 'Nom',
    company: 'Société',
    role: 'Rôle',
    email: 'Email',
    save: 'Enregistrer',
    cancel: 'Annuler',
    noClients: 'Aucun client pour le moment.',
    addSite: 'Associer un site',
    searchSite: 'Rechercher un site...',
    noSites: 'Aucun site trouvé.',
    deleteConfirm: 'Supprimer ce client ?',
     clientAdded: 'Client ajouté',
     clientUpdated: 'Client modifié',
     clientDeleted: 'Client supprimé',
     editClient: 'Modifier le client',
    siteLinked: 'Site associé au client',
    siteUnlinked: 'Site dissocié',
    creating: 'Création...',
  },
  en: {
    title: 'Clients',
    description: 'Manage your clients and link them to your sites',
    newClient: 'New client',
    firstName: 'First Name',
    lastName: 'Last Name',
    company: 'Company',
    role: 'Role',
    email: 'Email',
    save: 'Save',
    cancel: 'Cancel',
    noClients: 'No clients yet.',
    addSite: 'Link a site',
    searchSite: 'Search a site...',
    noSites: 'No sites found.',
    deleteConfirm: 'Delete this client?',
     clientAdded: 'Client added',
     clientUpdated: 'Client updated',
     clientDeleted: 'Client deleted',
     editClient: 'Edit client',
    siteLinked: 'Site linked to client',
    siteUnlinked: 'Site unlinked',
    creating: 'Creating...',
  },
  es: {
    title: 'Clientes',
    description: 'Gestione sus clientes y asócielos a sus sitios',
    newClient: 'Nuevo cliente',
    firstName: 'Nombre',
    lastName: 'Apellido',
    company: 'Empresa',
    role: 'Rol',
    email: 'Correo',
    save: 'Guardar',
    cancel: 'Cancelar',
    noClients: 'Aún no hay clientes.',
    addSite: 'Asociar un sitio',
    searchSite: 'Buscar un sitio...',
    noSites: 'No se encontraron sitios.',
    deleteConfirm: '¿Eliminar este cliente?',
    clientAdded: 'Cliente agregado',
    clientDeleted: 'Cliente eliminado',
    siteLinked: 'Sitio asociado al cliente',
    siteUnlinked: 'Sitio desvinculado',
    creating: 'Creando...',
  },
};

export function ClientsTab() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];

  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [clientSites, setClientSites] = useState<Record<string, ClientSite[]>>({});
  const [trackedSites, setTrackedSites] = useState<TrackedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sitePopoverOpen, setSitePopoverOpen] = useState<string | null>(null);
  const [shakingClient, setShakingClient] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({ first_name: '', last_name: '', company: '', role: '', email: '' });

  const fetchClients = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('agency_clients')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });
    
    const clientsList = (data || []) as AgencyClient[];
    setClients(clientsList);

    // Fetch linked sites for all clients
    if (clientsList.length > 0) {
      const clientIds = clientsList.map(c => c.id);
      const { data: links } = await supabase
        .from('agency_client_sites')
        .select('id, client_id, tracked_site_id')
        .in('client_id', clientIds);

      if (links && links.length > 0) {
        const siteIds = [...new Set(links.map(l => l.tracked_site_id))];
        const { data: sites } = await supabase
          .from('tracked_sites')
          .select('id, domain, site_name')
          .in('id', siteIds);

        const siteMap: Record<string, TrackedSite> = {};
        (sites || []).forEach(s => { siteMap[s.id] = s; });

        const grouped: Record<string, ClientSite[]> = {};
        links.forEach(l => {
          const site = siteMap[l.tracked_site_id];
          if (site) {
            if (!grouped[l.client_id]) grouped[l.client_id] = [];
            grouped[l.client_id].push({
              id: l.id,
              tracked_site_id: l.tracked_site_id,
              domain: site.domain,
              site_name: site.site_name,
            });
          }
        });
        setClientSites(grouped);
      } else {
        setClientSites({});
      }
    }
    setLoading(false);
  };

  const fetchTrackedSites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tracked_sites')
      .select('id, domain, site_name')
      .eq('user_id', user.id);
    setTrackedSites((data || []) as TrackedSite[]);
  };

  useEffect(() => {
    fetchClients();
    fetchTrackedSites();
  }, [user]);

  const handleCreate = async () => {
    if (!user || !form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('agency_clients').insert({
      owner_user_id: user.id,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      company: form.company.trim() || null,
      role: form.role.trim() || null,
      email: form.email.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t.clientAdded);
      setForm({ first_name: '', last_name: '', company: '', role: '', email: '' });
      setDialogOpen(false);
      fetchClients();
    }
  };

  const handleDelete = async (clientId: string) => {
    const { error } = await supabase.from('agency_clients').delete().eq('id', clientId);
    if (!error) {
      toast.success(t.clientDeleted);
      fetchClients();
    }
  };

  const handleLinkSite = async (clientId: string, siteId: string) => {
    const { error } = await supabase.from('agency_client_sites').insert({
      client_id: clientId,
      tracked_site_id: siteId,
    });
    if (error) {
      if (error.code === '23505') {
        toast.info(language === 'fr' ? 'Site déjà associé' : language === 'es' ? 'Sitio ya asociado' : 'Site already linked');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(t.siteLinked);
      fetchClients();
    }
    setSitePopoverOpen(null);
  };

  const handleUnlinkSite = async (linkId: string) => {
    const { error } = await supabase.from('agency_client_sites').delete().eq('id', linkId);
    if (!error) {
      toast.success(t.siteUnlinked);
      fetchClients();
    }
  };

  const getAvailableSites = (clientId: string) => {
    const linked = (clientSites[clientId] || []).map(s => s.tracked_site_id);
    return trackedSites.filter(s => !linked.includes(s.id));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-500" />
              {t.title}
            </CardTitle>
            <CardDescription className="mt-1">{t.description}</CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
            <UserPlus className="h-4 w-4" />
            {t.newClient}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4 text-center">
            <div className="p-3 rounded-full bg-violet-500/10">
              <Activity className="h-8 w-8 text-violet-400" />
            </div>
            <p className="text-sm text-muted-foreground">{t.noClients}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map(client => (
              <div key={client.id} className="flex items-start gap-3 p-4 rounded-xl border bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{client.first_name} {client.last_name}</span>
                    {client.company && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600">{client.company}</span>
                    )}
                    {client.role && (
                      <span className="text-xs text-muted-foreground">· {client.role}</span>
                    )}
                  </div>
                  {client.email && (
                    <p className="text-xs text-muted-foreground mt-0.5">{client.email}</p>
                  )}

                  {/* Linked sites */}
                  {(clientSites[client.id] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {clientSites[client.id].map(site => (
                        <span key={site.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-background border">
                          <Globe className="h-3 w-3 text-violet-500" />
                          {site.domain}
                          <button onClick={() => handleUnlinkSite(site.id)} className="ml-0.5 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Add site popover */}
                  <Popover open={sitePopoverOpen === client.id} onOpenChange={(open) => setSitePopoverOpen(open ? client.id : null)}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 text-violet-500 hover:bg-violet-500/10 ${shakingClient === client.id ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
                        onClick={(e) => {
                          if (trackedSites.length === 0) {
                            e.preventDefault();
                            e.stopPropagation();
                            setShakingClient(client.id);
                            setTimeout(() => setShakingClient(null), 500);
                            toast.warning(
                              language === 'fr'
                                ? 'Vous devez d\'abord tracker une URL dans Mes Sites.'
                                : language === 'es'
                                  ? 'Primero debe rastrear una URL en Mis Sitios.'
                                  : 'You must first track a URL in My Sites.'
                            );
                          }
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-72" align="end">
                      <Command shouldFilter={true}>
                        <CommandInput 
                          placeholder={t.searchSite} 
                          autoFocus
                          className="text-foreground"
                          style={{ color: 'var(--foreground)', caretColor: 'var(--foreground)' }}
                        />
                        <CommandList>
                          <CommandEmpty>{t.noSites}</CommandEmpty>
                          <CommandGroup heading={language === 'fr' ? 'Sites trackés' : language === 'es' ? 'Sitios rastreados' : 'Tracked sites'}>
                            {getAvailableSites(client.id).map(site => (
                              <CommandItem
                                key={site.id}
                                value={site.domain}
                                onSelect={() => handleLinkSite(client.id, site.id)}
                                className="cursor-pointer"
                              >
                                <Globe className="h-4 w-4 mr-2 text-violet-500" />
                                <div className="flex flex-col min-w-0">
                                  <span className="truncate text-sm font-medium">{site.site_name || site.domain}</span>
                                  {site.site_name && <span className="truncate text-xs text-muted-foreground">{site.domain}</span>}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(client.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* New Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-violet-500" />
              {t.newClient}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' ? 'Renseignez les informations du client.' : language === 'es' ? 'Complete la información del cliente.' : 'Fill in client details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.firstName} *</Label>
                <Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.lastName} *</Label>
                <Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.company}</Label>
                <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.role}</Label>
                <Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.email}</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.cancel}</Button>
              <Button
                onClick={handleCreate}
                disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
