import { useState, useEffect, useCallback } from 'react';
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
import { Search, Trash2, Plus, Minus, RefreshCw, Loader2, Users, CreditCard, AlertTriangle, ShieldCheck, Crown, Link2, Eye, EyeOff, ChevronDown, FileSearch, Filter, X } from 'lucide-react';
import { UserKpiModal } from './UserKpiModal';
import { CreateAffiliateModal } from './CreateAffiliateModal';

/** Actionable event types to expose in the filter (label → event_type(s)) */
const ACTION_FILTERS: { label: string; types: string[]; color: string }[] = [
  { label: 'Audit Expert', types: ['expert_audit_launched'], color: 'text-amber-500' },
  { label: 'Audit Comparé', types: ['audit_compare_launched'], color: 'text-violet-500' },
  { label: 'Analyse Magnet', types: ['free_analysis_crawlers'], color: 'text-blue-500' },
  { label: 'Crawl Multi-page', types: ['multi_page_crawl'], color: 'text-emerald-500' },
  { label: 'Cocoon', types: ['cocoon_generated'], color: 'text-teal-500' },
  { label: 'Code Correctif', types: ['corrective_code_generated', 'corrective_code_downloaded'], color: 'text-orange-500' },
  { label: 'Inscription', types: ['signup_completed', 'signup_click'], color: 'text-sky-500' },
];

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
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [userIdsByAction, setUserIdsByAction] = useState<Set<string>>(new Set());
  const [actionFilterLoading, setActionFilterLoading] = useState(false);

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
    const labels: Record<string, string> = { admin: 'Créateur', viewer: 'Viewer', viewer_level2: 'Viewer L2', auditor: 'Auditeur' };
    const hasRole = (role === 'admin' && adminUserIds.has(userId))
      || (role === 'viewer' && viewerUserIds.has(userId))
      || (role === 'viewer_level2' && viewer2UserIds.has(userId))
      || (role === 'auditor' && auditorUserIds.has(userId));

    try {
      if (hasRole) {
        // Already has this role → remove it
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role as any);
        toast.success(`Rôle ${labels[role]} retiré`);
      } else if (role === 'auditor') {
        // Auditor is cumulative — just add it with 2h expiry
        const insertData: any = { user_id: userId, role: role as any, expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() };
        await supabase.from('user_roles').insert(insertData);
        toast.success(`Rôle Auditeur attribué (expire dans 2h)`);
      } else {
        // Non-auditor roles remain exclusive among themselves (admin/viewer/viewer_level2)
        const currentBase = adminUserIds.has(userId) ? 'admin'
          : viewerUserIds.has(userId) ? 'viewer'
          : viewer2UserIds.has(userId) ? 'viewer_level2'
          : null;
        if (currentBase) {
          await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', currentBase as any);
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

  // Fetch user IDs matching the selected action filter
  const fetchActionFilter = useCallback(async (filterLabel: string | null) => {
    setActionFilter(filterLabel);
    if (!filterLabel) {
      setUserIdsByAction(new Set());
      return;
    }
    setActionFilterLoading(true);
    try {
      const filter = ACTION_FILTERS.find(f => f.label === filterLabel);
      if (!filter) return;

      const { data } = await supabase
        .from('analytics_events')
        .select('user_id')
        .in('event_type', filter.types)
        .not('user_id', 'is', null);

      const ids = new Set<string>((data || []).map((e: any) => e.user_id).filter(Boolean));
      setUserIdsByAction(ids);
    } catch (err) {
      console.error('Action filter error:', err);
    } finally {
      setActionFilterLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchAllRoles();
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = !actionFilter || userIdsByAction.has(user.user_id);
    return matchesSearch && matchesAction;
  });

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
              {filteredUsers.length}/{users.length} utilisateurs{actionFilter ? ` • filtre : ${actionFilter}` : ''}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={actionFilter ? 'default' : 'outline'} size="sm" className="gap-1.5 shrink-0" disabled={actionFilterLoading}>
                {actionFilterLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />}
                {actionFilter || 'Actions'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Filtrer par action</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ACTION_FILTERS.map((f) => (
                <DropdownMenuItem
                  key={f.label}
                  onClick={() => fetchActionFilter(actionFilter === f.label ? null : f.label)}
                  className="gap-2"
                >
                  <span className={`h-2 w-2 rounded-full ${f.color.replace('text-', 'bg-')}`} />
                  {actionFilter === f.label ? `✓ ${f.label}` : f.label}
                </DropdownMenuItem>
              ))}
              {actionFilter && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => fetchActionFilter(null)} className="gap-2 text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                    Réinitialiser
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground">Cumulable (2h)</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => toggleRole(user.user_id, 'auditor')}>
                                <FileSearch className="h-4 w-4 mr-2" />
                                {auditorUserIds.has(user.user_id) ? '✓ Auditeur' : 'Auditeur'}
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
