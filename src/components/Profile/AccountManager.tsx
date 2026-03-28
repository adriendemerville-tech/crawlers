import { useState, useEffect } from 'react';
import { Users, Crown, UserPlus, Copy, Trash2, Loader2, Check, Link2, Shield, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const translations = {
  fr: {
    title: 'Gestion des comptes',
    description: 'Gérez les collaborateurs de votre équipe',
    ownerAccount: 'Compte propriétaire',
    you: '(vous)',
    invite: 'Inviter',
    role: 'Rôle',
    owner: 'Propriétaire',
    collaborator: 'Collaborateur',
    ownerDesc: 'Accès total à toutes les fonctionnalités',
    collaboratorDesc: 'Tout sauf facturation, paiement et branding',
    pendingInvitations: 'Invitations en attente',
    copyLink: 'Copier le lien',
    copied: 'Copié !',
    revoke: 'Révoquer',
    remove: 'Retirer',
    maxReached: 'Nombre maximum de comptes atteint',
    inviteCreated: 'Invitation créée',
    memberRemoved: 'Membre retiré',
    inviteRevoked: 'Invitation révoquée',
    expires: 'Expire le',
    noMembers: 'Aucun collaborateur pour le moment',
    generateLink: 'Générer un lien d\'invitation',
    teamMembers: 'Membres de l\'équipe',
    slots: 'places',
    used: 'utilisées',
  },
  en: {
    title: 'Account Management',
    description: 'Manage your team collaborators',
    ownerAccount: 'Owner Account',
    you: '(you)',
    invite: 'Invite',
    role: 'Role',
    owner: 'Owner',
    collaborator: 'Collaborator',
    ownerDesc: 'Full access to all features',
    collaboratorDesc: 'Everything except billing, payment, and branding',
    pendingInvitations: 'Pending Invitations',
    copyLink: 'Copy link',
    copied: 'Copied!',
    revoke: 'Revoke',
    remove: 'Remove',
    maxReached: 'Maximum accounts reached',
    inviteCreated: 'Invitation created',
    memberRemoved: 'Member removed',
    inviteRevoked: 'Invitation revoked',
    expires: 'Expires on',
    noMembers: 'No collaborators yet',
    generateLink: 'Generate invitation link',
    teamMembers: 'Team Members',
    slots: 'slots',
    used: 'used',
  },
  es: {
    title: 'Gestión de cuentas',
    description: 'Gestione sus colaboradores de equipo',
    ownerAccount: 'Cuenta propietaria',
    you: '(usted)',
    invite: 'Invitar',
    role: 'Rol',
    owner: 'Propietario',
    collaborator: 'Colaborador',
    ownerDesc: 'Acceso total a todas las funcionalidades',
    collaboratorDesc: 'Todo excepto facturación, pago y branding',
    pendingInvitations: 'Invitaciones pendientes',
    copyLink: 'Copiar enlace',
    copied: '¡Copiado!',
    revoke: 'Revocar',
    remove: 'Eliminar',
    maxReached: 'Número máximo de cuentas alcanzado',
    inviteCreated: 'Invitación creada',
    memberRemoved: 'Miembro eliminado',
    inviteRevoked: 'Invitación revocada',
    expires: 'Expira el',
    noMembers: 'Ningún colaborador por el momento',
    generateLink: 'Generar enlace de invitación',
    teamMembers: 'Miembros del equipo',
    slots: 'plazas',
    used: 'utilizadas',
  },
};

interface TeamMember {
  id: string;
  owner_user_id: string;
  member_user_id: string;
  role: string;
  profile?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Invitation {
  id: string;
  token: string;
  role: string;
  email: string | null;
  status: string;
  expires_at: string;
}

export function AccountManager() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('collaborator');

  const isAgencyPremium = profile?.plan_type === 'agency_premium';
  const maxCollaborators = isAgencyPremium ? 2 : 1;
  const totalSlots = members.length + invitations.length;
  const canInvite = totalSlots < maxCollaborators;

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-team', {
        body: { action: 'list_team' },
      });
      if (error) throw error;
      setMembers(data.members || []);
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error('Error fetching team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleCreateInvitation = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-team', {
        body: { action: 'create_invitation', role: selectedRole },
      });
      if (error) throw error;
      
      // Auto-copy the invitation link
      if (data?.invitation?.token) {
        const link = `${window.location.origin}/auth?invite=${data.invitation.token}`;
        await navigator.clipboard.writeText(link);
        toast.success(t.inviteCreated + ' — ' + t.copied);
      } else {
        toast.success(t.inviteCreated);
      }
      await fetchTeam();
    } catch (err: any) {
      toast.error(err?.message || String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async (token: string, id: string) => {
    const link = `${window.location.origin}/auth?invite=${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(id);
    toast.success(t.copied);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (invitationId: string) => {
    try {
      await supabase.functions.invoke('manage-team', {
        body: { action: 'revoke_invitation', invitation_id: invitationId },
      });
      toast.success(t.inviteRevoked);
      await fetchTeam();
    } catch (err: any) {
      toast.error(String(err));
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await supabase.functions.invoke('manage-team', {
        body: { action: 'remove_member', member_id: memberId },
      });
      toast.success(t.memberRemoved);
      await fetchTeam();
    } catch (err: any) {
      toast.error(String(err));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
      { day: 'numeric', month: 'short', year: 'numeric' }
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-violet-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-violet-500" />
              {t.title}
            </CardTitle>
            <Badge variant="outline" className="border-violet-500/30 text-violet-600">
              {totalSlots + 1}/{maxCollaborators + 1} {t.slots} {t.used}
            </Badge>
          </div>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Owner (current user) */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-violet-500/10">
                <Crown className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  {profile?.first_name} {profile?.last_name} {t.you}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Badge className="bg-violet-600 text-white">{t.owner}</Badge>
          </div>

          {/* Team members */}
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-muted">
                  {member.role === 'owner' ? (
                    <Shield className="h-4 w-4 text-violet-500" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {member.profile?.first_name} {member.profile?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.profile?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {member.role === 'owner' ? t.owner : t.collaborator}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(member.id)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {members.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              {t.noMembers}
            </p>
          )}

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {t.pendingInvitations}
              </p>
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-500/10">
                      <Link2 className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {inv.role === 'owner' ? t.owner : t.collaborator}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.expires} {formatDate(inv.expires_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyLink(inv.token, inv.id)}
                      className="gap-1 text-xs"
                    >
                      {copiedId === inv.id ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiedId === inv.id ? t.copied : t.copyLink}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevoke(inv.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create invitation */}
          {canInvite && (
            <div className="flex items-center gap-3 pt-2">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    <div className="flex items-center gap-2">
                      <Crown className="h-3 w-3" />
                      {t.owner}
                    </div>
                  </SelectItem>
                  <SelectItem value="collaborator">
                    <div className="flex items-center gap-2">
                      <Eye className="h-3 w-3" />
                      {t.collaborator}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleCreateInvitation}
                disabled={creating}
                className="gap-2 bg-violet-600 hover:bg-violet-700"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {t.generateLink}
              </Button>
            </div>
          )}

          {!canInvite && (
            <p className="text-sm text-amber-600 text-center py-1">
              {t.maxReached}
            </p>
          )}

          {/* Role descriptions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <div className="p-2.5 rounded-lg bg-muted/30 border text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <Crown className="h-3 w-3 text-violet-500" />
                {t.owner}
              </div>
              <p className="text-muted-foreground">{t.ownerDesc}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/30 border text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <Eye className="h-3 w-3 text-muted-foreground" />
                {t.collaborator}
              </div>
              <p className="text-muted-foreground">{t.collaboratorDesc}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
