import { createContext, useContext, useState, useCallback } from 'react';

interface AISidebarState {
  felixExpanded: boolean;
  cocoonExpanded: boolean;
  cocoonWidth: number;
  setFelixExpanded: (v: boolean) => void;
  setCocoonExpanded: (v: boolean) => void;
  setCocoonWidth: (v: number) => void;
}

const AISidebarContext = createContext<AISidebarState>({
  felixExpanded: false,
  cocoonExpanded: false,
  cocoonWidth: 432,
  setFelixExpanded: () => {},
  setCocoonExpanded: () => {},
  setCocoonWidth: () => {},
});

export function AISidebarProvider({ children }: { children: React.ReactNode }) {
  const [felixExpanded, setFelixExpanded] = useState(false);
  const [cocoonExpanded, setCocoonExpanded] = useState(false);
  const [cocoonWidth, setCocoonWidth] = useState(432);

  return (
    <AISidebarContext.Provider value={{ felixExpanded, cocoonExpanded, cocoonWidth, setFelixExpanded, setCocoonExpanded, setCocoonWidth }}>
      {children}
    </AISidebarContext.Provider>
  );
}

export function useAISidebar() {
  return useContext(AISidebarContext);
}
