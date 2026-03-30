import { useState } from 'react';

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  credits_balance: number;
  created_at: string;
  plan_type?: string;
  persona_type?: string | null;
  updated_at?: string;
  affiliate_code_used?: string | null;
}

interface UseUserActionsParams {
  setSelectedUser: (u: UserProfile | null) => void;
  setDeleteDialogOpen: (v: boolean) => void;
  setCreditDialogOpen: (v: boolean) => void;
  setStripDialogOpen: (v: boolean) => void;
  openEditDialog: (u: UserProfile) => void;
  toggleRole: (userId: string, role: string) => void;
  setKpiModalOpen: (v: boolean) => void;
}

export function useUserActions({
  setSelectedUser,
  setDeleteDialogOpen,
  setCreditDialogOpen,
  setStripDialogOpen,
  openEditDialog,
  toggleRole,
  setKpiModalOpen,
}: UseUserActionsParams) {
  return {
    onDeleteUser: (u: UserProfile) => {
      setSelectedUser(u);
      setDeleteDialogOpen(true);
      setKpiModalOpen(false);
    },
    onToggleRole: (userId: string, role: string) => toggleRole(userId, role),
    onManageCredits: (u: UserProfile) => {
      setSelectedUser(u);
      setCreditDialogOpen(true);
      setKpiModalOpen(false);
    },
    onStripPro: (u: UserProfile) => {
      setSelectedUser(u);
      setStripDialogOpen(true);
      setKpiModalOpen(false);
    },
    onEditProfile: (u: UserProfile) => {
      openEditDialog(u);
      setKpiModalOpen(false);
    },
  };
}
