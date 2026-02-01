import React, { useState, useEffect } from "react";

interface DebugLoaderProps {
  name: string;
  children: React.ReactNode;
}

export function DebugLoader({ name, children }: DebugLoaderProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Mark as loaded once component mounts
    setLoaded(true);
    // eslint-disable-next-line no-console
    console.log(`[DebugLoader] ✅ ${name} loaded`);
  }, [name]);

  if (!loaded) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
        <p className="text-xl font-bold text-black">Chargement: {name}...</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Debug-wrapped lazy loader
export function createDebugLazy<T extends React.ComponentType<any>>(
  name: string,
  factory: () => Promise<{ default: T }>
) {
  const LazyComponent = React.lazy(async () => {
    // eslint-disable-next-line no-console
    console.log(`[DebugLoader] ⏳ Loading ${name}...`);
    try {
      const module = await factory();
      // eslint-disable-next-line no-console
      console.log(`[DebugLoader] ✅ ${name} module loaded`);
      return module;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[DebugLoader] ❌ ${name} FAILED`, err);
      throw err;
    }
  });

  return function DebugWrappedComponent(props: React.ComponentProps<T>) {
    return (
      <React.Suspense
        fallback={
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
            <p className="text-xl font-bold text-black">Chargement: {name}...</p>
          </div>
        }
      >
        <LazyComponent {...props} />
      </React.Suspense>
    );
  };
}
