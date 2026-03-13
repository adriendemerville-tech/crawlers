import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Link2, Copy, Check, Plus, RefreshCw, Search, Trash2, ToggleLeft, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CreateAffiliateModal } from './CreateAffiliateModal';

interface AffiliateCode {
  id: string;
  code: string;
  created_by: string;
  assigned_to_user_id: string | null;
  discount_percent: number;
  duration_months: number;
  max_activations: number;
  current_activations: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function AffiliateManagement() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<AffiliateCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('affiliate_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCodes((data as unknown as AffiliateCode[]) || []);
    } catch (err) {
      console.error('Error fetching affiliate codes:', err);
      toast.error('Erreur lors du chargement des codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('affiliate_codes')
        .update({ is_active: !currentState } as any)
        .eq('id', id);

      if (error) throw error;
      setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentState } : c));
      toast.success(`Code ${!currentState ? 'activé' : 'désactivé'}`);
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const deleteCode = async (id: string, code: string) => {
    if (!confirm(`Supprimer le code ${code} ? Cette action est irréversible.`)) return;
    try {
      const { error } = await supabase
        .from('affiliate_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCodes(prev => prev.filter(c => c.id !== id));
      toast.success('Code supprimé');
    } catch (err) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success('Code copié !');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = codes.filter(c =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.assigned_to_user_id && c.assigned_to_user_id.includes(searchQuery))
  );

  const activeCount = codes.filter(c => c.is_active).length;
  const totalActivations = codes.reduce((sum, c) => sum + c.current_activations, 0);
  const fullCodes = codes.filter(c => c.current_activations >= c.max_activations).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <Link2 className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Codes d'affiliation</h3>
            <p className="text-sm text-muted-foreground">
              {codes.length} code{codes.length > 1 ? 's' : ''} • {activeCount} actif{activeCount > 1 ? 's' : ''} • {totalActivations} activation{totalActivations > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCodes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => setShowCreateModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4 mr-1" />
            Créer un code
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total codes</p>
            <p className="text-2xl font-bold">{codes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Actifs</p>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Activations totales</p>
            <p className="text-2xl font-bold text-violet-600">{totalActivations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Complets</p>
            <p className="text-2xl font-bold text-amber-600">{fullCodes}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un code..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Réduction</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Activations</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Aucun code trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(code => (
                  <TableRow key={code.id} className={!code.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold tracking-wider text-violet-600 dark:text-violet-400">
                          {code.code}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyCode(code.code, code.id)}
                        >
                          {copiedId === code.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={code.discount_percent === 100 ? 'default' : 'secondary'}>
                        {code.discount_percent}%
                      </Badge>
                    </TableCell>
                    <TableCell>{code.duration_months} mois</TableCell>
                    <TableCell>
                      <span className={code.current_activations >= code.max_activations ? 'text-amber-600 font-semibold' : ''}>
                        {code.current_activations}/{code.max_activations}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={code.is_active}
                        onCheckedChange={() => toggleActive(code.id, code.is_active)}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(code.created_at), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteCode(code.id, code.code)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showCreateModal && user && (
        <CreateAffiliateModal
          open={showCreateModal}
          onOpenChange={(open) => {
            setShowCreateModal(open);
            if (!open) fetchCodes();
          }}
          userName="Nouveau"
          userEmail=""
          userId=""
        />
      )}
    </div>
  );
}
