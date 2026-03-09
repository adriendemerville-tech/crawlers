import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, Trash2, Plus, Minus, RefreshCw, Loader2, Users, CreditCard, AlertTriangle } from 'lucide-react';
import { UserKpiModal } from './UserKpiModal';

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  credits_balance: number;
  created_at: string;
  updated_at: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [kpiUser, setKpiUser] = useState<UserProfile | null>(null);
  const [kpiModalOpen, setKpiModalOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Admin can view all profiles via RLS policy
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.last_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCredits = async (amount: number) => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      const newBalance = selectedUser.credits_balance + amount;
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits_balance: newBalance })
        .eq('user_id', selectedUser.user_id);

      if (updateError) throw updateError;

      // Record transaction
      const { error: txError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: selectedUser.user_id,
          amount: amount,
          transaction_type: amount > 0 ? 'admin_credit' : 'admin_debit',
          description: amount > 0 ? 'Crédit ajouté par admin' : 'Crédit retiré par admin'
        });

      if (txError) console.error('Transaction log error:', txError);

      toast.success(`${amount > 0 ? 'Crédits ajoutés' : 'Crédits retirés'} avec succès`);
      setCreditDialogOpen(false);
      setCreditAmount('');
      fetchUsers();
    } catch (error) {
      console.error('Error updating credits:', error);
      toast.error('Erreur lors de la mise à jour des crédits');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      // Get last payment for this user
      const { data: payments, error: paymentError } = await supabase
        .from('stripe_payments')
        .select('*')
        .eq('user_id', selectedUser.user_id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (paymentError) throw paymentError;

      if (!payments || payments.length === 0) {
        toast.error('Aucun paiement trouvé pour cet utilisateur');
        return;
      }

      // Mark payment as refunded
      const { error: refundError } = await supabase
        .from('stripe_payments')
        .update({ status: 'refunded' })
        .eq('id', payments[0].id);

      if (refundError) throw refundError;

      toast.success('Remboursement marqué. Effectuez le remboursement Stripe manuellement.');
      setCreditDialogOpen(false);
    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error('Erreur lors du traitement du remboursement');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      // Delete user profile (cascade will handle related data)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', selectedUser.user_id);

      if (error) throw error;

      toast.success('Utilisateur supprimé avec succès');
      setDeleteDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gestion des Utilisateurs
            </CardTitle>
            <CardDescription>
              {users.length} utilisateurs inscrits
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Crédits</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucun utilisateur trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={user.credits_balance > 0 ? 'default' : 'secondary'}>
                          {user.credits_balance}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog open={creditDialogOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                            setCreditDialogOpen(open);
                            if (open) setSelectedUser(user);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <CreditCard className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Gérer les crédits</DialogTitle>
                                <DialogDescription>
                                  {user.first_name} {user.last_name} - Solde actuel: {user.credits_balance} crédits
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Montant de crédits</Label>
                                  <Input
                                    type="number"
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(e.target.value)}
                                    placeholder="Ex: 10"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleAddCredits(parseInt(creditAmount) || 0)}
                                    disabled={!creditAmount || actionLoading}
                                    className="flex-1"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Ajouter
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => handleAddCredits(-(parseInt(creditAmount) || 0))}
                                    disabled={!creditAmount || actionLoading}
                                    className="flex-1"
                                  >
                                    <Minus className="h-4 w-4 mr-2" />
                                    Retirer
                                  </Button>
                                </div>
                                <div className="border-t pt-4">
                                  <Button
                                    variant="secondary"
                                    onClick={handleRefund}
                                    disabled={actionLoading}
                                    className="w-full"
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Marquer dernier paiement comme remboursé
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={deleteDialogOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                            setDeleteDialogOpen(open);
                            if (open) setSelectedUser(user);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-destructive">
                                  <AlertTriangle className="h-5 w-5" />
                                  Supprimer l'utilisateur
                                </DialogTitle>
                                <DialogDescription>
                                  Êtes-vous sûr de vouloir supprimer {user.first_name} {user.last_name} ({user.email}) ?
                                  Cette action est irréversible.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                  Annuler
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  onClick={handleDeleteUser}
                                  disabled={actionLoading}
                                >
                                  {actionLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 mr-2" />
                                  )}
                                  Supprimer
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
