import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CreditCard, CheckCircle2, Copy, Code, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

const translations = {
  fr: {
    title: 'Générer le Code Correctif',
    subtitle: 'Obtenez le code JSON-LD optimisé pour votre site',
    price: '5€',
    loading: 'Préparation de votre code...',
    payButton: 'Payer avec Revolut Pay',
    success: 'Code généré avec succès !',
    copyButton: 'Copier le code',
    copied: 'Copié !',
    installInstructions: 'Copiez ce code et collez-le dans le <head> de votre site.',
  },
  en: {
    title: 'Generate Corrective Code',
    subtitle: 'Get the optimized JSON-LD code for your site',
    price: '€5',
    loading: 'Preparing your code...',
    payButton: 'Pay with Revolut Pay',
    success: 'Code generated successfully!',
    copyButton: 'Copy code',
    copied: 'Copied!',
    installInstructions: 'Copy this code and paste it in the <head> of your site.',
  },
  es: {
    title: 'Generar Código Correctivo',
    subtitle: 'Obtén el código JSON-LD optimizado para tu sitio',
    price: '5€',
    loading: 'Preparando tu código...',
    payButton: 'Pagar con Revolut Pay',
    success: '¡Código generado con éxito!',
    copyButton: 'Copiar código',
    copied: '¡Copiado!',
    installInstructions: 'Copia este código y pégalo en el <head> de tu sitio.',
  },
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteUrl: string;
  siteName: string;
}

type PaymentStep = 'loading' | 'payment' | 'success';

export function PaymentModal({ isOpen, onClose, siteUrl, siteName }: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('loading');
  const [copied, setCopied] = useState(false);
  const { language } = useLanguage();
  const t = translations[language] || translations.fr;
  const { toast } = useToast();

  // Mock JSON-LD code
  const jsonLdCode = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${siteName}",
  "url": "${siteUrl}",
  "sameAs": [],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service"
  },
  "description": "Site web optimisé pour le SEO et les moteurs IA"
}
</script>`;

  useEffect(() => {
    if (isOpen) {
      setStep('loading');
      // 3 second loading animation
      const timer = setTimeout(() => {
        setStep('payment');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handlePayment = () => {
    // Simulate payment success
    setStep('success');
    toast({
      title: t.success,
      description: t.installInstructions,
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonLdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>
            {t.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <AnimatePresence mode="wait">
            {/* Loading Step */}
            {step === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                  <Loader2 className="w-12 h-12 text-primary" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 text-muted-foreground"
                >
                  {t.loading}
                </motion.p>

                {/* Progress dots */}
                <div className="flex gap-2 mt-6">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Payment Step */}
            {step === 'payment' && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">Code JSON-LD Optimisé</p>
                        <p className="text-sm text-muted-foreground">{siteName}</p>
                      </div>
                      <div className="text-2xl font-bold text-primary">{t.price}</div>
                    </div>
                  </CardContent>
                </Card>

                <Button 
                  onClick={handlePayment}
                  className="w-full h-12 text-base font-medium gap-2 bg-indigo-600 hover:bg-indigo-700"
                >
                  <CreditCard className="w-5 h-5" />
                  {t.payButton}
                </Button>

                {/* Revolut logo placeholder */}
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    Paiement sécurisé par Revolut
                  </p>
                </div>
              </motion.div>
            )}

            {/* Success Step */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                  className="flex justify-center"
                >
                  <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-success" />
                  </div>
                </motion.div>

                <p className="text-center font-semibold text-foreground">{t.success}</p>

                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                      <Code className="w-4 h-4" />
                      {t.installInstructions}
                    </div>
                    <pre className="text-xs bg-background p-3 rounded-lg overflow-x-auto border">
                      <code>{jsonLdCode}</code>
                    </pre>
                  </CardContent>
                </Card>

                <Button 
                  onClick={handleCopy}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      {t.copied}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {t.copyButton}
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
