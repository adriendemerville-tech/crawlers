import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

const translations = {
  fr: {
    reportProblem: 'Signaler un problème',
    title: 'Signaler un problème',
    description: 'Décrivez le problème rencontré et nous vous répondrons dans les plus brefs délais.',
    subject: 'Sujet',
    subjectPlaceholder: 'Décrivez brièvement le problème',
    message: 'Message',
    messagePlaceholder: 'Décrivez le problème en détail...',
    send: 'Envoyer',
    sending: 'Envoi...',
    cancel: 'Annuler',
    success: 'Votre message a été envoyé. Nous vous répondrons rapidement.',
    error: 'Erreur lors de l\'envoi du message',
  },
  en: {
    reportProblem: 'Report a problem',
    title: 'Report a problem',
    description: 'Describe the issue you encountered and we will get back to you as soon as possible.',
    subject: 'Subject',
    subjectPlaceholder: 'Briefly describe the problem',
    message: 'Message',
    messagePlaceholder: 'Describe the problem in detail...',
    send: 'Send',
    sending: 'Sending...',
    cancel: 'Cancel',
    success: 'Your message has been sent. We will respond shortly.',
    error: 'Error sending message',
  },
  es: {
    reportProblem: 'Reportar un problema',
    title: 'Reportar un problema',
    description: 'Describe el problema que encontraste y te responderemos lo antes posible.',
    subject: 'Asunto',
    subjectPlaceholder: 'Describe brevemente el problema',
    message: 'Mensaje',
    messagePlaceholder: 'Describe el problema en detalle...',
    send: 'Enviar',
    sending: 'Enviando...',
    cancel: 'Cancelar',
    success: 'Tu mensaje ha sido enviado. Te responderemos pronto.',
    error: 'Error al enviar el mensaje',
  },
};

export function ReportProblemButton() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = translations[language];
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim() || !user) return;

    setSending(true);

    try {
      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('support_conversations')
        .insert([{
          user_id: user.id,
          subject: subject.trim(),
          status: 'open',
        }])
        .select('id')
        .single();

      if (convError || !conversation) {
        throw convError;
      }

      // Create message
      const { error: msgError } = await supabase.from('support_messages').insert([{
        conversation_id: conversation.id,
        sender_id: user.id,
        content: message.trim(),
        is_admin: false,
      }]);

      if (msgError) {
        throw msgError;
      }

      toast.success(t.success);
      setOpen(false);
      setSubject('');
      setMessage('');
    } catch (error) {
      console.error('Error reporting problem:', error);
      toast.error(t.error);
    }

    setSending(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <AlertTriangle className="h-4 w-4" />
          {t.reportProblem}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">{t.subject}</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t.subjectPlaceholder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">{t.message}</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.messagePlaceholder}
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={sending || !subject.trim() || !message.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t.sending}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t.send}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
