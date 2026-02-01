import React, { useState, useEffect } from "react";

const RETRY_KEY = "chunk_retry_guard";

interface DebugLoaderProps {
  name: string;
  children: React.ReactNode;
}

export function DebugLoader({ name, children }: DebugLoaderProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
    console.log(`[DebugLoader] ✅ ${name} loaded`);
  }, [name]);

  if (!loaded) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
        <p className="text-xl font-bold text-foreground">Chargement: {name}...</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Robust lazy loader with retry on chunk failure
export function createDebugLazy<T extends React.ComponentType<any>>(
  name: string,
  factory: () => Promise<{ default: T }>
) {
  const LazyComponent = React.lazy(async () => {
    console.log(`[DebugLoader] ⏳ Loading ${name}...`);
    try {
      const module = await factory();
      // Clear retry guard on success
      try { localStorage.removeItem(RETRY_KEY); } catch {}
      console.log(`[DebugLoader] ✅ ${name} module loaded`);
      return module;
    } catch (err) {
      console.error(`[DebugLoader] ❌ ${name} FAILED`, err);
      
      // Check if we already retried
      const alreadyRetried = localStorage.getItem(RETRY_KEY) === "1";
      
      if (!alreadyRetried) {
        console.log(`[DebugLoader] 🔄 Retrying with hard reload...`);
        try { localStorage.setItem(RETRY_KEY, "1"); } catch {}
        // Hard reload to fetch fresh assets
        window.location.reload();
      }
      
      // If already retried, rethrow for error boundary
      throw err;
    }
  });

  return function DebugWrappedComponent(props: React.ComponentProps<T>) {
    return (
      <React.Suspense
        fallback={
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
            <p className="text-xl font-bold text-foreground">Chargement: {name}...</p>
          </div>
        }
      >
        <LazyComponent {...props} />
      </React.Suspense>
    );
  };
}
