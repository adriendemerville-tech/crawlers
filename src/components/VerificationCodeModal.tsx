import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

const translations = {
  fr: {
    title: 'Vérifiez votre email',
    description: 'Un code à 6 chiffres a été envoyé à',
    confirm: 'Confirmer',
    verifying: 'Vérification...',
    invalidCode: 'Code invalide ou expiré',
    success: 'Email vérifié avec succès !',
    resend: 'Renvoyer le code',
    resending: 'Envoi...',
    resent: 'Code renvoyé !',
    checkSpam: 'Vérifiez aussi vos spams.',
  },
  en: {
    title: 'Verify your email',
    description: 'A 6-digit code was sent to',
    confirm: 'Confirm',
    verifying: 'Verifying...',
    invalidCode: 'Invalid or expired code',
    success: 'Email verified successfully!',
    resend: 'Resend code',
    resending: 'Sending...',
    resent: 'Code resent!',
    checkSpam: 'Also check your spam folder.',
  },
  es: {
    title: 'Verifica tu email',
    description: 'Se envió un código de 6 dígitos a',
    confirm: 'Confirmar',
    verifying: 'Verificando...',
    invalidCode: 'Código inválido o expirado',
    success: '¡Email verificado con éxito!',
    resend: 'Reenviar código',
    resending: 'Enviando...',
    resent: '¡Código reenviado!',
    checkSpam: 'Revisa también tu carpeta de spam.',
  },
};

interface VerificationCodeModalProps {
  open: boolean;
  email: string;
  onVerified: () => void;
  onClose: () => void;
}

export function VerificationCodeModal({ open, email, onVerified, onClose }: VerificationCodeModalProps) {
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState(false);
  const [verified, setVerified] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCode('');
      setError(false);
      setVerified(false);
    }
  }, [open]);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setIsVerifying(true);
    setError(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('auth-actions', {
        body: { action: 'verify-code', email, code },
      });

      if (fnError || !data?.success) {
        setError(true);
        setIsVerifying(false);
        return;
      }

      setVerified(true);
      toast.success(t.success);

      // Close after brief delay to show success state
      setTimeout(() => {
        onVerified();
      }, 1200);
    } catch {
      setError(true);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError(false);
    setCode('');

    try {
      await supabase.functions.invoke('auth-actions', {
        body: { action: 'send-code', email },
      });
      toast.success(t.resent);
    } catch {
      toast.error('Error');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !verified && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-3">
            <AnimatePresence mode="wait">
              {verified ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </motion.div>
              ) : (
                <motion.div
                  key="mail"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <Mail className="w-6 h-6 text-primary" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <DialogTitle>{verified ? t.success : t.title}</DialogTitle>
          {!verified && (
            <DialogDescription className="text-center">
              {t.description} <span className="font-medium text-foreground">{email}</span>
              <br />
              <span className="text-xs text-muted-foreground">{t.checkSpam}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        {!verified && (
          <div className="space-y-4 mt-2">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setError(false);
                }}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 text-sm text-destructive"
                >
                  <XCircle className="w-4 h-4" />
                  {t.invalidCode}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              onClick={handleVerify}
              disabled={code.length !== 6 || isVerifying}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t.verifying}
                </>
              ) : (
                t.confirm
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {isResending ? t.resending : t.resend}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
