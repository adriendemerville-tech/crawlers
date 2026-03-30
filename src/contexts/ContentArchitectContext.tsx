import { createContext, useContext } from 'react';

export interface ContentArchitectContextType {
  result: any;
  setResult: (v: any) => void;
  loading: boolean;
  url: string;
  isEdited: boolean;
  onResetEdits: () => void;
  showGuide: boolean;
  setShowGuide: (v: boolean) => void;
  language: string;
  counters: { h1: number; h2: number; h3: number; chars: number; medias: number; links: number };
  onSaveDraft?: () => void;
  onPublish?: () => void;
  publishing?: boolean;
  savingDraft?: boolean;
  hasCmsConnection?: boolean;
  isExistingPage?: boolean;
  creditsCost?: number | null;
  colorTheme: 'cocoon' | 'green';
}

const ContentArchitectContext = createContext<ContentArchitectContextType | null>(null);

export const ContentArchitectProvider = ContentArchitectContext.Provider;

export function useContentArchitect() {
  const ctx = useContext(ContentArchitectContext);
  if (!ctx) throw new Error('useContentArchitect must be used within ContentArchitectProvider');
  return ctx;
}
