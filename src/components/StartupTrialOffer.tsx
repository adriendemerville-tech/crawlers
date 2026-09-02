import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Building2, CheckCircle2, FileCheck2, Loader2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { submitStartupTrial, verifyStartupSiret } from '@/lib/startupTrial.functions';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function StartupTrialOffer() {
  const { user, refreshProfile } = useAuth();
  const verify = useServerFn(verifyStartupSiret);
  const submit = useServerFn(submitStartupTrial);
  const [open, setOpen] = useState(false);
  const [siret, setSiret] = useState('');
  const [company, setCompany] = useState<{ legalName: string; creationDate: string; siret: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [manualReview, setManualReview] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: () => verify({ data: { siret } }),
    onSuccess: (result) => {
      if (!result.eligible || !result.legalName || !result.creationDate || !result.siret) {
        setCompany(null);
        setError(result.reason ?? 'Entreprise non éligible.');
        return;
      }
      setError('');
      setCompany({ legalName: result.legalName, creationDate: result.creationDate, siret: result.siret });
    },
    onError: (err: Error) => setError(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user || !company || !file) throw new Error('Complétez la vérification et joignez le Kbis.');
      if (file.type !== 'application/pdf' || file.size > MAX_FILE_SIZE) throw new Error('Le Kbis doit être un PDF de 10 Mo maximum.');
      const path = `${user.id}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage.from('startup-trial-kbis').upload(path, file, {
        contentType: 'application/pdf',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      return submit({ data: {
        siret: company.siret,
        legalName: company.legalName,
        creationDate: company.creationDate,
        kbisPath: path,
        verificationDetails: { source: 'recherche-entreprises.api.gouv.fr' },
      } });
    },
    onSuccess: async (result) => {
      if (result.status === 'review') {
        setManualReview(true);
        toast.success('Votre dossier a été transmis pour vérification manuelle.');
        return;
      }
      setSuccess(true);
      toast.success('Votre accès Pro Agency est actif pendant 12 mois.');
      await refreshProfile();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (manualReview) {
    return (
      <Alert className="border-amber-500/50 bg-amber-500/5">
        <FileCheck2 className="h-5 w-5 text-amber-500" />
        <AlertTitle>Dossier en attente de vérification</AlertTitle>
        <AlertDescription>Le SIRET est éligible, mais le Kbis nécessite une vérification manuelle avant l’activation de l’offre.</AlertDescription>
      </Alert>
    );
  }

  if (success) {
    return (
      <Alert className="border-amber-500/50 bg-amber-500/5">
        <CheckCircle2 className="h-5 w-5 text-amber-500" />
        <AlertTitle>Accès Pro Agency activé</AlertTitle>
        <AlertDescription>Votre offre entreprise de moins de 12 mois est valable pendant un an, sans paiement.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="border-amber-500/50 bg-amber-500/5">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-amber-500" />
          <div>
            <CardTitle>Un an offert pour les jeunes entreprises</CardTitle>
            <CardDescription className="mt-1">Entreprises et freelances immatriculés depuis moins de 12 mois : Pro Agency offert pendant un an.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!user ? (
          <Button variant="outline" onClick={() => { sessionStorage.setItem('startup_trial_return_path', '/tarifs'); window.location.href = '/auth'; }}>
            Se connecter pour vérifier mon entreprise
          </Button>
        ) : !open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>Vérifier mon éligibilité</Button>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="startup-siret">SIRET</Label>
                <Input id="startup-siret" inputMode="numeric" value={siret} onChange={(event) => { setSiret(event.target.value); setCompany(null); setError(''); }} placeholder="14 chiffres" />
              </div>
              <Button variant="outline" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
                {verifyMutation.isPending && <Loader2 className="animate-spin" />}
                Vérifier le SIRET
              </Button>
            </div>

            {company && (
              <div className="flex items-start gap-3 border border-emerald-500/40 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div><p className="font-medium">{company.legalName}</p><p className="text-muted-foreground">Création : {new Date(company.creationDate).toLocaleDateString('fr-FR')}</p></div>
              </div>
            )}

            {company && <div className="space-y-2"><Label htmlFor="startup-kbis">Extrait Kbis (PDF, 10 Mo maximum)</Label><Input id="startup-kbis" type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><p className="text-xs text-muted-foreground">Le document est conservé dans un espace privé et accessible uniquement à votre compte et à l’équipe de validation.</p></div>}

            {error && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

            {company && <Button variant="outline" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || !file}>
              {submitMutation.isPending ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
              Activer mon année Pro Agency
            </Button>}
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Upload className="h-3.5 w-3.5" />Le SIRET est vérifié auprès de l’annuaire officiel et le Kbis est rapproché automatiquement avant activation.</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
