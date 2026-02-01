import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Trash2, CreditCard, PlusCircle, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  credits_balance: number;
  created_at: string;
}

interface AdminUserManagementProps {
  language: 'fr' | 'en' | 'es';
}

const translations = {
  fr: {
    search: 'Rechercher un utilisateur...',
    name: 'Nom',
    email: 'Email',
    credits: 'Crédits',
    memberSince: 'Inscription',
    actions: 'Actions',
    addCredits: 'Ajouter crédits',
    refund: 'Rembourser',
    delete: 'Supprimer',
    makeAdmin: 'Admin',
    confirmDelete: 'Confirmer la suppression',
    deleteWarning: 'Cette action est irréversible. L\'utilisateur et toutes ses données seront supprimés.',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    creditAmount: 'Nombre de crédits',
    addCreditsTitle: 'Ajouter des crédits',
    addCreditsDesc: 'Ajoutez des crédits au compte de l\'utilisateur',
    noUsers: 'Aucun utilisateur trouvé',
    loading: 'Chargement...',
    success: 'Opération réussie',
    error: 'Une erreur est survenue',
  },
  en: {
    search: 'Search user...',
    name: 'Name',
    email: 'Email',
    credits: 'Credits',
    memberSince: 'Member since',
    actions: 'Actions',
    addCredits: 'Add credits',
    refund: 'Refund',
    delete: 'Delete',
    makeAdmin: 'Admin',
    confirmDelete: 'Confirm deletion',
    deleteWarning: 'This action is irreversible. The user and all their data will be deleted.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    creditAmount: 'Credit amount',
    addCreditsTitle: 'Add credits',
    addCreditsDesc: 'Add credits to user account',
    noUsers: 'No users found',
    loading: 'Loading...',
    success: 'Operation successful',
    error: 'An error occurred',
  },
  es: {
    search: 'Buscar usuario...',
    name: 'Nombre',
    email: 'Email',
    credits: 'Créditos',
    memberSince: 'Miembro desde',
    actions: 'Acciones',
    addCredits: 'Agregar créditos',
    refund: 'Reembolsar',
    delete: 'Eliminar',
    makeAdmin: 'Admin',
    confirmDelete: 'Confirmar eliminación',
    deleteWarning: 'Esta acción es irreversible. El usuario y todos sus datos serán eliminados.',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    creditAmount: 'Cantidad de créditos',
    addCreditsTitle: 'Agregar créditos',
    addCreditsDesc: 'Agregar créditos a la cuenta del usuario',
    noUsers: 'No se encontraron usuarios',
    loading: 'Cargando...',
    success: 'Operación exitosa',
    error: 'Ocurrió un error',
  },
};

export function AdminUserManagement({ language }: AdminUserManagementProps) {
  const t = translations[language];
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [creditAmount, setCreditAmount] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      toast.error(t.error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCredits = async () => {
    if (!selectedUser) return;

    const { error } = await supabase
      .from('profiles')
      .update({ credits_balance: selectedUser.credits_balance + creditAmount })
      .eq('id', selectedUser.id);

    if (error) {
      toast.error(t.error);
    } else {
      // Log the transaction
      await supabase.from('credit_transactions').insert({
        user_id: selectedUser.user_id,
        amount: creditAmount,
        transaction_type: 'admin_add',
        description: 'Crédits ajoutés par l\'administrateur',
      });
      toast.success(t.success);
      fetchUsers();
    }
    setCreditDialogOpen(false);
  };

  const handleRefund = async (user: UserProfile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ credits_balance: user.credits_balance + 1 })
      .eq('id', user.id);

    if (error) {
      toast.error(t.error);
    } else {
      await supabase.from('credit_transactions').insert({
        user_id: user.user_id,
        amount: 1,
        transaction_type: 'refund',
        description: 'Remboursement par l\'administrateur',
      });
      toast.success(t.success);
      fetchUsers();
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    // Delete user profile (cascade will handle related data)
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', selectedUser.id);

    if (error) {
      toast.error(t.error);
    } else {
      toast.success(t.success);
      fetchUsers();
    }
    setDeleteDialogOpen(false);
  };

  const handleMakeAdmin = async (user: UserProfile) => {
    const { error } = await supabase.from('user_roles').insert({
      user_id: user.user_id,
      role: 'admin',
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('Cet utilisateur est déjà admin');
      } else {
        toast.error(t.error);
      }
    } else {
      toast.success(t.success);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">{t.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t.search}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{t.noUsers}</div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.name}</TableHead>
                <TableHead>{t.email}</TableHead>
                <TableHead className="text-center">{t.credits}</TableHead>
                <TableHead>{t.memberSince}</TableHead>
                <TableHead className="text-right">{t.actions}</TableHead>
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
                    <Badge variant="secondary">{user.credits_balance}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString(language)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user);
                          setCreditDialogOpen(true);
                        }}
                        title={t.addCredits}
                      >
                        <PlusCircle className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRefund(user)}
                        title={t.refund}
                      >
                        <CreditCard className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMakeAdmin(user)}
                        title={t.makeAdmin}
                      >
                        <Shield className="h-4 w-4 text-amber-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user);
                          setDeleteDialogOpen(true);
                        }}
                        title={t.delete}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Credits Dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.addCreditsTitle}</DialogTitle>
            <DialogDescription>{t.addCreditsDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.creditAmount}</Label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleAddCredits}>{t.confirm}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.confirmDelete}</DialogTitle>
            <DialogDescription>{t.deleteWarning}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
