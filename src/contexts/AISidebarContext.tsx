import { createContext, useContext, useState, useCallback } from 'react';

interface AISidebarState {
  felixExpanded: boolean;
  cocoonExpanded: boolean;
  setFelixExpanded: (v: boolean) => void;
  setCocoonExpanded: (v: boolean) => void;
}

const AISidebarContext = createContext<AISidebarState>({
  felixExpanded: false,
  cocoonExpanded: false,
  setFelixExpanded: () => {},
  setCocoonExpanded: () => {},
});

export function AISidebarProvider({ children }: { children: React.ReactNode }) {
  const [felixExpanded, setFelixExpanded] = useState(false);
  const [cocoonExpanded, setCocoonExpanded] = useState(false);

  return (
    <AISidebarContext.Provider value={{ felixExpanded, cocoonExpanded, setFelixExpanded, setCocoonExpanded }}>
      {children}
    </AISidebarContext.Provider>
  );
}

export function useAISidebar() {
  return useContext(AISidebarContext);
}
