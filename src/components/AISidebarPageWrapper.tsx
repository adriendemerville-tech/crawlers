import { useAISidebar } from '@/contexts/AISidebarContext';

/**
 * Wraps page content and adjusts padding when AI sidebars are expanded.
 * Felix sidebar = right (24rem), Cocoon sidebar = left (28rem).
 */
export function AISidebarPageWrapper({ children }: { children: React.ReactNode }) {
  const { felixExpanded, cocoonExpanded } = useAISidebar();

  return (
    <div
      className="transition-all duration-300 ease-in-out min-h-screen"
      style={{
        paddingRight: felixExpanded ? '24rem' : undefined,
        paddingLeft: cocoonExpanded ? '28rem' : undefined,
      }}
    >
      {children}
    </div>
  );
}
