import { useSessionHeartbeat } from '@/hooks/useSessionHeartbeat';

/**
 * Manages session heartbeat and shows a full-screen modal when the session is kicked.
 * No close button, no escape — user is disconnected after 30s countdown.
 */
export function SessionHeartbeatManager() {
  const { isKicked, countdown } = useSessionHeartbeat();

  if (!isKicked) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-border bg-card text-card-foreground shadow-2xl p-8 text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <svg
            className="w-7 h-7 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3" />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Session reprise depuis un autre appareil
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Une connexion a été détectée depuis une autre adresse IP.
            Votre travail en cours est sauvegardé automatiquement.
          </p>
        </div>

        {/* Countdown */}
        <div className="space-y-3">
          <div className="text-3xl font-mono font-bold tabular-nums text-foreground">
            {countdown}<span className="text-muted-foreground text-lg ml-1">s</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Déconnexion automatique…
          </p>
          {/* Progress bar */}
          <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-foreground/30 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / 30) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
