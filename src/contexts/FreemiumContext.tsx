import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FreemiumConfig {
  /** When true, audit expert + code gen are open without login */
  openMode: boolean;
  loading: boolean;
}

const FreemiumContext = createContext<FreemiumConfig>({ openMode: false, loading: true });

export function FreemiumProvider({ children }: { children: React.ReactNode }) {
  const [openMode, setOpenMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'freemium_open_mode')
          .maybeSingle();
        setOpenMode(data?.value === true || (data?.value as any)?.enabled === true);
      } catch {
        // fail-safe: keep closed
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <FreemiumContext.Provider value={{ openMode, loading }}>
      {children}
    </FreemiumContext.Provider>
  );
}

export function useFreemiumMode() {
  return useContext(FreemiumContext);
}
