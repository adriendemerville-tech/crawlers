import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, Trash2, Plus, Minus, RefreshCw, Loader2, Users, CreditCard, AlertTriangle, ShieldCheck, Crown, Link2, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { UserKpiModal } from './UserKpiModal';
import { CreateAffiliateModal } from './CreateAffiliateModal';

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  credits_balance: number;
  plan_type: string;
  created_at: string;
  updated_at: string;
  affiliate_code_used?: string | null;
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
  const [adminUserIds, setAdminUserIds] = useState<Set<string>>(new Set());
  const [viewerUserIds, setViewerUserIds] = useState<Set<string>>(new Set());
  const [viewer2UserIds, setViewer2UserIds] = useState<Set<string>>(new Set());
  const [auditorUserIds, setAuditorUserIds] = useState<Set<string>>(new Set());
  const [stripDialogOpen, setStripDialogOpen] = useState(false);
  const [affiliateModalOpen, setAffiliateModalOpen] = useState(false);
  const [affiliateUser, setAffiliateUser] = useState<UserProfile | null>(null);

  const fetchAllRoles = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id, role');
    if (data) {
      const admins = new Set<string>();
      const viewers = new Set<string>();
      const viewers2 = new Set<string>();
      const auditors = new Set<string>();
      data.forEach((r: any) => {
        if (r.role === 'admin') admins.add(r.user_id);
        if (r.role === 'viewer') viewers.add(r.user_id);
        if (r.role === 'viewer_level2') viewers2.add(r.user_id);
        if (r.role === 'auditor') auditors.add(r.user_id);
      });
      setAdminUserIds(admins);
      setViewerUserIds(viewers);
      setViewer2UserIds(viewers2);
      setAuditorUserIds(auditors);
    }
  };

  const getUserCurrentRole = (userId: string): string | null => {
    if (adminUserIds.has(userId)) return 'admin';
    if (viewerUserIds.has(userId)) return 'viewer';
    if (viewer2UserIds.has(userId)) return 'viewer_level2';
    if (auditorUserIds.has(userId)) return 'auditor';
    return null;
  };

  const toggleRole = async (userId: string, role: string) => {
    const currentRole = getUserCurrentRole(userId);
    const labels: Record<string, string> = { admin: 'Créateur', viewer: 'Viewer', viewer_level2: 'Viewer L2' };
    try {
      if (currentRole === role) {
        // Same role clicked → remove it
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role as any);
        toast.success(`Rôle ${labels[role]} retiré`);
      } else {
        // Different role → remove existing then insert new (exclusive)
        if (currentRole) {
          await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', currentRole as any);
        }
        await supabase.from('user_roles').insert({ user_id: userId, role: role as any });
        toast.success(`Rôle ${labels[role]} attribué`);
      }
      fetchAllRoles();
    } catch {
      toast.error('Erreur lors de la modification du rôle');
    }
  };

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
    fetchAllRoles();
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

  const handleStripProAgency = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('admin-update-plan', {
        body: { target_user_id: selectedUser.user_id },
      });
      if (res.error) throw res.error;
      toast.success(`Abonnement Pro Agency retiré pour ${selectedUser.first_name} ${selectedUser.last_name}`);
      setStripDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error stripping Pro Agency:', error);
      toast.error('Erreur lors du retrait de l\'abonnement');
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
                    <TableRow key={user.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => { setKpiUser(user); setKpiModalOpen(true); }}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          {user.first_name} {user.last_name}
                          {adminUserIds.has(user.user_id) && (
                            <Badge variant="outline" className="text-xs border-primary text-primary">Créateur</Badge>
                          )}
                          {!adminUserIds.has(user.user_id) && viewerUserIds.has(user.user_id) && (
                            <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-600 dark:text-emerald-400">Viewer</Badge>
                          )}
                          {!adminUserIds.has(user.user_id) && !viewerUserIds.has(user.user_id) && viewer2UserIds.has(user.user_id) && (
                            <Badge variant="outline" className="text-xs border-sky-500 text-sky-600 dark:text-sky-400">Viewer L2</Badge>
                          )}
                          {user.affiliate_code_used && (
                            <Badge variant="outline" className="text-xs border-violet-500 text-violet-600 dark:text-violet-400 gap-1">
                              <Link2 className="h-2.5 w-2.5" />
                              {user.affiliate_code_used}
                            </Badge>
                          )}
                        </div>
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
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant={(adminUserIds.has(user.user_id) || viewerUserIds.has(user.user_id) || viewer2UserIds.has(user.user_id)) ? 'default' : 'outline'}
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                              >
                                <ShieldCheck className="h-4 w-4" />
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel className="text-xs text-muted-foreground">Rôles</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => toggleRole(user.user_id, 'admin')}>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                {adminUserIds.has(user.user_id) ? '✓ Créateur' : 'Créateur'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => toggleRole(user.user_id, 'viewer')}>
                                <Eye className="h-4 w-4 mr-2" />
                                {viewerUserIds.has(user.user_id) ? '✓ Viewer' : 'Viewer'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleRole(user.user_id, 'viewer_level2')}>
                                <EyeOff className="h-4 w-4 mr-2" />
                                {viewer2UserIds.has(user.user_id) ? '✓ Viewer L2' : 'Viewer L2'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {user.plan_type === 'agency_pro' && (
                            <Dialog open={stripDialogOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                              setStripDialogOpen(open);
                              if (open) setSelectedUser(user);
                            }}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                                  title="Retirer Pro Agency"
                                >
                                  <Crown className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2 text-amber-600">
                                    <Crown className="h-5 w-5" />
                                    Retirer l'abonnement Pro Agency
                                  </DialogTitle>
                                  <DialogDescription>
                                    Voulez-vous retirer l'abonnement Pro Agency de {user.first_name} {user.last_name} ({user.email}) ?
                                    Son plan passera en « free ».
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setStripDialogOpen(false)}>
                                    Annuler
                                  </Button>
                                  <Button
                                    variant="default"
                                    className="bg-amber-600 hover:bg-amber-700"
                                    onClick={handleStripProAgency}
                                    disabled={actionLoading}
                                  >
                                    {actionLoading ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                      <Crown className="h-4 w-4 mr-2" />
                                    )}
                                    Retirer Pro Agency
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
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
                                <div className="border-t pt-4 space-y-2">
                                  <Button
                                    variant="secondary"
                                    onClick={handleRefund}
                                    disabled={actionLoading}
                                    className="w-full"
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Marquer dernier paiement comme remboursé
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setAffiliateUser(user);
                                      setAffiliateModalOpen(true);
                                      setCreditDialogOpen(false);
                                    }}
                                    className="w-full border-violet-500/40 text-violet-600 dark:text-violet-400 hover:bg-violet-500/5"
                                  >
                                    <Link2 className="h-4 w-4 mr-2" />
                                    Créer un code d'affiliation
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

      <UserKpiModal user={kpiUser} open={kpiModalOpen} onOpenChange={setKpiModalOpen} />
      
      {affiliateUser && (
        <CreateAffiliateModal
          open={affiliateModalOpen}
          onOpenChange={setAffiliateModalOpen}
          userName={`${affiliateUser.first_name} ${affiliateUser.last_name}`}
          userEmail={affiliateUser.email}
          userId={affiliateUser.user_id}
        />
      )}
    </Card>
  );
}
