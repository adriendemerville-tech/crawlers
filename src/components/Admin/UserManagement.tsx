import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, UserPlus, Trash2, RefreshCcw, Coins, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  credits_balance: number;
  created_at: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [isCreditsDialogOpen, setIsCreditsDialogOpen] = useState(false);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erreur lors du chargement des utilisateurs');
      console.error(error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }

  async function handleAddCredits() {
    if (!selectedUser || !creditAmount) return;
    setActionLoading(true);

    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Montant invalide');
      setActionLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits_balance: selectedUser.credits_balance + amount })
      .eq('user_id', selectedUser.user_id);

    if (updateError) {
      toast.error('Erreur lors de l\'ajout de crédits');
    } else {
      // Log the transaction
      await supabase.from('credit_transactions').insert({
        user_id: selectedUser.user_id,
        amount: amount,
        transaction_type: 'admin_credit',
        description: `Ajout admin: +${amount} crédits`
      });

      toast.success(`${amount} crédits ajoutés à ${selectedUser.email}`);
      fetchUsers();
    }

    setActionLoading(false);
    setIsCreditsDialogOpen(false);
    setCreditAmount('');
  }

  async function handleRefund() {
    if (!selectedUser || !refundAmount) return;
    setActionLoading(true);

    const amount = parseInt(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Montant invalide');
      setActionLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits_balance: selectedUser.credits_balance + amount })
      .eq('user_id', selectedUser.user_id);

    if (updateError) {
      toast.error('Erreur lors du remboursement');
    } else {
      await supabase.from('credit_transactions').insert({
        user_id: selectedUser.user_id,
        amount: amount,
        transaction_type: 'refund',
        description: `Remboursement admin: +${amount} crédits`
      });

      toast.success(`${amount} crédits remboursés à ${selectedUser.email}`);
      fetchUsers();
    }

    setActionLoading(false);
    setIsRefundDialogOpen(false);
    setRefundAmount('');
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;
    setActionLoading(true);

    // Note: We can only delete the profile, not the auth user (requires admin API)
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', selectedUser.user_id);

    if (error) {
      toast.error('Erreur lors de la suppression');
    } else {
      toast.success(`Profil de ${selectedUser.email} supprimé`);
      fetchUsers();
    }

    setActionLoading(false);
    setIsDeleteDialogOpen(false);
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Gestion des utilisateurs</span>
          <Badge variant="secondary">{users.length} utilisateurs</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par email, nom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={fetchUsers}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-md border">
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
                {filteredUsers.map((user) => (
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
                      <div className="flex justify-end gap-1">
                        <Dialog open={isCreditsDialogOpen && selectedUser?.id === user.id} onOpenChange={setIsCreditsDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedUser(user)}
                              title="Ajouter des crédits"
                            >
                              <Coins className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Ajouter des crédits</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p className="text-sm text-muted-foreground">
                                Utilisateur : <strong>{selectedUser?.email}</strong>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Solde actuel : <strong>{selectedUser?.credits_balance} crédits</strong>
                              </p>
                              <div className="space-y-2">
                                <Label>Nombre de crédits à ajouter</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={creditAmount}
                                  onChange={(e) => setCreditAmount(e.target.value)}
                                  placeholder="10"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsCreditsDialogOpen(false)}>
                                Annuler
                              </Button>
                              <Button onClick={handleAddCredits} disabled={actionLoading}>
                                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                                Ajouter
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Dialog open={isRefundDialogOpen && selectedUser?.id === user.id} onOpenChange={setIsRefundDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedUser(user)}
                              title="Rembourser"
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Rembourser l'utilisateur</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p className="text-sm text-muted-foreground">
                                Utilisateur : <strong>{selectedUser?.email}</strong>
                              </p>
                              <div className="space-y-2">
                                <Label>Nombre de crédits à rembourser</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={refundAmount}
                                  onChange={(e) => setRefundAmount(e.target.value)}
                                  placeholder="5"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsRefundDialogOpen(false)}>
                                Annuler
                              </Button>
                              <Button onClick={handleRefund} disabled={actionLoading}>
                                {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Rembourser
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <Dialog open={isDeleteDialogOpen && selectedUser?.id === user.id} onOpenChange={setIsDeleteDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedUser(user)}
                              title="Supprimer"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Supprimer l'utilisateur</DialogTitle>
                            </DialogHeader>
                            <p className="text-sm text-muted-foreground">
                              Êtes-vous sûr de vouloir supprimer le profil de <strong>{selectedUser?.email}</strong> ?
                              Cette action est irréversible.
                            </p>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                                Annuler
                              </Button>
                              <Button variant="destructive" onClick={handleDeleteUser} disabled={actionLoading}>
                                {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Supprimer
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
