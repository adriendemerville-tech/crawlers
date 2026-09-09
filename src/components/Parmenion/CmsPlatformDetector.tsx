import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check, HelpCircle } from 'lucide-react';
import { detectSitePlatform } from '@/lib/cms/cmsDetect.functions';
import { CMS_PLATFORMS, platformLabel, type CmsPlatform } from '@/lib/cms/platformFingerprints';
import { CmsConnectionDialog } from '@/components/Profile/CmsConnectionDialog';

const btn =
  'h-10 gap-2 border border-foreground bg-transparent px-4 text-sm text-foreground hover:bg-foreground hover:text-background';

type Detection = Awaited<ReturnType<typeof detectSitePlatform>>;

interface Props {
  /** URL du site auditée dans la commande. */
  siteUrl: string | null;
  onConnected?: () => void;
}

/**
 * Détecte la plateforme du site et n'affiche que la voie de connexion utile.
 * Repli manuel « je ne sais pas » listant les sept plateformes prises en charge.
 */
export function CmsPlatformDetector({ siteUrl, onConnected }: Props): React.ReactElement {
  const [state, setState] = useState<'idle' | 'detecting' | 'done'>('idle');
  const [detection, setDetection] = useState<Detection | null>(null);
  const [manual, setManual] = useState(false);
  const [dialogFor, setDialogFor] = useState<CmsPlatform | null>(null);

  const run = useCallback(async () => {
    if (!siteUrl) return;
    setState('detecting');
    try {
      const res = await detectSitePlatform({ data: { url: siteUrl } });
      setDetection(res);
    } catch {
      setDetection(null);
    } finally {
      setState('done');
    }
  }, [siteUrl]);

  const detected = detection?.platform ?? null;
  const sure = detected !== null && detection?.confidence !== 'low';

  return (
    <div className="space-y-4">
      {state === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Nous identifions la technologie de votre site pour ne vous proposer que la bonne connexion.
            Vous n'avez rien à savoir de technique.
          </p>
          <Button onClick={() => void run()} disabled={!siteUrl} className={btn}>
            Identifier mon site
          </Button>
          {!siteUrl && (
            <p className="text-xs text-muted-foreground">
              Aucune adresse de site enregistrée sur cette commande.
            </p>
          )}
        </div>
      )}

      {state === 'detecting' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyse de {siteUrl}…
        </p>
      )}

      {state === 'done' && (
        <div className="space-y-4">
          {detected && sure ? (
            <div className="rounded-lg border border-border p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Check className="h-4 w-4 text-primary" />
                Votre site tourne sous {platformLabel(detected)}
              </p>
              {detection?.signals.length ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {detection.signals.slice(0, 3).map((s) => (
                    <li key={s.evidence}>{s.evidence}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => setDialogFor(detected)} className={btn}>
                  Connecter mon site {platformLabel(detected)}
                </Button>
                <Button
                  onClick={() => setManual(true)}
                  className="h-10 border border-border bg-transparent px-4 text-sm text-muted-foreground hover:text-foreground"
                >
                  Ce n'est pas ça
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <HelpCircle className="h-4 w-4 text-primary" />
                {detection?.reachable === false
                  ? "Nous n'avons pas pu joindre votre site"
                  : "Nous n'avons pas pu identifier votre site avec certitude"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Choisissez la plateforme dans la liste, ou demandez-nous de le faire pour vous depuis l'aide.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button onClick={() => setManual(true)} className={btn}>
                  Choisir dans la liste
                </Button>
                <Button
                  onClick={() => void run()}
                  className="h-10 border border-border bg-transparent px-4 text-sm text-muted-foreground hover:text-foreground"
                >
                  Réessayer
                </Button>
              </div>
            </div>
          )}

          {manual && (
            <div className="rounded-lg border border-border p-4">
              <p className="mb-3 text-sm font-medium">Je ne sais pas — voici les plateformes prises en charge</p>
              <div className="flex flex-wrap gap-2">
                {CMS_PLATFORMS.map((p) => (
                  <Button
                    key={p.id}
                    onClick={() => setDialogFor(p.id)}
                    className="h-9 border border-foreground bg-transparent px-3 text-xs text-foreground hover:bg-foreground hover:text-background"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Si votre site n'est sur aucune de ces plateformes, nous vous livrons les correctifs prêts à coller.
              </p>
            </div>
          )}
        </div>
      )}

      {dialogFor && (
        <CmsConnectionDialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setDialogFor(null);
              onConnected?.();
            }
          }}
          cmsType={dialogFor}
        />
      )}
    </div>
  );
}
