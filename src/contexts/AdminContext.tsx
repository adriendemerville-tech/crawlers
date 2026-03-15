import { createContext, useContext } from 'react';

interface AdminContextType {
  readOnly: boolean;
}

const AdminContext = createContext<AdminContextType>({ readOnly: false });

export const AdminProvider = AdminContext.Provider;
export const useAdminContext = () => useContext(AdminContext);
