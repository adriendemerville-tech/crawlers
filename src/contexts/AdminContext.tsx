import { createContext, useContext } from 'react';

interface AdminContextType {
  readOnly: boolean;
  canSeeDocs: boolean;
  canSeeAlgos: boolean;
  docsHiddenForViewers: boolean;
}

const AdminContext = createContext<AdminContextType>({ 
  readOnly: false, 
  canSeeDocs: true, 
  canSeeAlgos: true,
  docsHiddenForViewers: false,
});

export const AdminProvider = AdminContext.Provider;
export const useAdminContext = () => useContext(AdminContext);
