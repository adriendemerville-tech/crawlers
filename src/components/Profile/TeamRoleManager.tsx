import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCredits } from '@/contexts/CreditsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Shield, Pencil, Eye, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { TeamRole } from '@/hooks/useTeamPermissions';

interface TeamMember {
  id: string;
  member_user_id: string;
  team_role: TeamRole;
  email?: string;
  first_name?: string;
}

const ROLE_CONFIG: Record<TeamRole, { label_fr: string; label_en: string; icon: typeof Shield; color: string }> = {
  owner: { label_fr: 'Propriétaire', label_en: 'Owner', icon: Shield, color: 'text-amber-500' },
  editor: { label_fr: 'Éditeur', label_en: 'Editor', icon: Pencil, color: 'text-blue-500' },
  auditor: { label_fr: 'Auditeur', label_en: 'Auditor', icon: Eye, color: 'text-emerald-500' },
};

const ROLE_DESCRIPTIONS: Record<TeamRole, { fr: string; en: string }> = {
  owner: { fr: 'Accès complet + gestion des rôles', en: 'Full access + role management' },
  editor: { fr: 'Audit + injection de contenu', en: 'Audit + content injection' },
  auditor: { fr: 'Audit + plan d\'action (pas d\'injection)', en: 'Audit + action plan (no injection)' },
};

export function TeamRoleManager() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('agency_team_members')
        .select('id, member_user_id, team_role')
        .eq('owner_user_id', user.id);

      if (data && data.length > 0) {
        // Fetch member profiles
        const memberIds = data.map(m => m.member_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, first_name')
          .in('id', memberIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));

        setMembers(data.map(m => ({
          ...m,
          team_role: (m.team_role as TeamRole) || 'auditor',
          email: profileMap.get(m.member_user_id)?.email,
          first_name: profileMap.get(m.member_user_id)?.first_name,
        })));
      }
      setLoading(false);
    })();
  }, [user]);

  const updateRole = async (memberId: string, newRole: TeamRole) => {
    setUpdating(memberId);
    const { error } = await supabase
      .from('agency_team_members')
      .update({ team_role: newRole } as any)
      .eq('id', memberId)
      .eq('owner_user_id', user!.id);

    if (error) {
      toast.error(language === 'fr' ? 'Erreur de mise à jour du rôle' : 'Role update error');
    } else {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, team_role: newRole } : m));
      const roleLabel = ROLE_CONFIG[newRole][language === 'fr' ? 'label_fr' : 'label_en'];
      toast.success(language === 'fr' ? `Rôle mis à jour : ${roleLabel}` : `Role updated: ${roleLabel}`);
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (members.length === 0) return null;

  return (
    <Card className="border-blue-500/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-blue-500" />
          {language === 'fr' ? 'Rôles de l\'équipe' : 'Team Roles'}
        </CardTitle>
        <CardDescription className="text-xs">
          {language === 'fr'
            ? 'Définissez les permissions de chaque membre de votre équipe.'
            : 'Set permissions for each team member.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map(member => {
            const cfg = ROLE_CONFIG[member.team_role];
            const RoleIcon = cfg.icon;
            return (
              <div
                key={member.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-md border border-border/50 hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <RoleIcon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {member.first_name || member.email || member.member_user_id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {ROLE_DESCRIPTIONS[member.team_role][language === 'fr' ? 'fr' : 'en']}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {updating === member.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Select
                      value={member.team_role}
                      onValueChange={(val) => updateRole(member.id, val as TeamRole)}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auditor">
                          <div className="flex items-center gap-1.5">
                            <Eye className="h-3 w-3 text-emerald-500" />
                            {language === 'fr' ? 'Auditeur' : 'Auditor'}
                          </div>
                        </SelectItem>
                        <SelectItem value="editor">
                          <div className="flex items-center gap-1.5">
                            <Pencil className="h-3 w-3 text-blue-500" />
                            {language === 'fr' ? 'Éditeur' : 'Editor'}
                          </div>
                        </SelectItem>
                        <SelectItem value="owner">
                          <div className="flex items-center gap-1.5">
                            <Shield className="h-3 w-3 text-amber-500" />
                            {language === 'fr' ? 'Propriétaire' : 'Owner'}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-3 gap-2">
          {(['auditor', 'editor', 'owner'] as TeamRole[]).map(r => {
            const cfg = ROLE_CONFIG[r];
            const Icon = cfg.icon;
            return (
              <div key={r} className="text-center">
                <Icon className={`h-3.5 w-3.5 mx-auto mb-0.5 ${cfg.color}`} />
                <span className="text-[10px] font-medium block">{cfg[language === 'fr' ? 'label_fr' : 'label_en']}</span>
                <span className="text-[9px] text-muted-foreground">
                  {ROLE_DESCRIPTIONS[r][language === 'fr' ? 'fr' : 'en']}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
