import { useSessionHeartbeat } from '@/hooks/useSessionHeartbeat';

/**
 * Invisible component that activates the session heartbeat.
 * Must be rendered inside AuthProvider.
 */
export function SessionHeartbeatManager() {
  useSessionHeartbeat();
  return null;
}
