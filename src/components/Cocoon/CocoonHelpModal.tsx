import { useState, useRef } from 'react';
import { HelpCircle, Send, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const faqItems = {
  fr: [
    {
      q: "Comment générer un cocon sémantique ?",
      a: "Sélectionnez un site tracké dans le menu déroulant, puis cliquez sur « Générer le Cocon ». Le système analyse les données de votre crawl pour construire l'architecture sémantique automatiquement."
    },
    {
      q: "Que signifie le mode X-Ray ?",
      a: "Le mode X-Ray révèle les pages fantômes à faible trafic et met en évidence les opportunités de contenu inexploitées dans votre maillage interne."
    },
    {
      q: "Pourquoi mon cocon n'affiche aucun nœud ?",
      a: "Assurez-vous d'avoir effectué un crawl multi-pages sur le site sélectionné. Le module Cocoon nécessite des données de crawl pour construire le graphe sémantique."
    },
    {
      q: "Comment interpréter les clusters de couleur ?",
      a: "Chaque cluster regroupe des pages par proximité sémantique. Les couleurs distinguent les thématiques détectées par l'IA. Plus un nœud est gros, plus la page est centrale dans le maillage."
    },
    {
      q: "Le module Cocoon est-il inclus dans mon abonnement ?",
      a: "Le module Cocoon est réservé aux abonnés Pro Agency (59€/mois). Il inclut l'audit expert illimité, le code correctif illimité et la marque blanche."
    }
  ],
  en: [
    {
      q: "How do I generate a semantic cocoon?",
      a: "Select a tracked site from the dropdown, then click 'Generate Cocoon'. The system analyzes your crawl data to build the semantic architecture automatically."
    },
    {
      q: "What does X-Ray mode do?",
      a: "X-Ray mode reveals ghost pages with low traffic and highlights untapped content opportunities in your internal linking."
    },
    {
      q: "Why does my cocoon show no nodes?",
      a: "Make sure you've performed a multi-page crawl on the selected site. The Cocoon module requires crawl data to build the semantic graph."
    },
    {
      q: "How do I interpret the color clusters?",
      a: "Each cluster groups pages by semantic proximity. Colors distinguish themes detected by the AI. The larger a node, the more central the page is."
    },
    {
      q: "Is the Cocoon module included in my plan?",
      a: "The Cocoon module is exclusive to Pro Agency subscribers (59€/month). It includes unlimited expert audits, corrective code, and white-label features."
    }
  ],
  es: [
    {
      q: "¿Cómo genero un cocoon semántico?",
      a: "Seleccione un sitio rastreado del menú desplegable, luego haga clic en 'Generar Cocoon'. El sistema analiza los datos de su rastreo para construir la arquitectura semántica automáticamente."
    },
    {
      q: "¿Qué hace el modo X-Ray?",
      a: "El modo X-Ray revela páginas fantasma con bajo tráfico y destaca oportunidades de contenido inexploradas en su enlazado interno."
    },
    {
      q: "¿Por qué mi cocoon no muestra nodos?",
      a: "Asegúrese de haber realizado un rastreo multi-página en el sitio seleccionado. El módulo Cocoon requiere datos de rastreo."
    },
    {
      q: "¿Cómo interpreto los clusters de color?",
      a: "Cada cluster agrupa páginas por proximidad semántica. Los colores distinguen las temáticas detectadas por la IA."
    },
    {
      q: "¿El módulo Cocoon está incluido en mi plan?",
      a: "El módulo Cocoon es exclusivo para suscriptores Pro Agency (59€/mes)."
    }
  ]
};

const labels = {
  fr: { title: "Besoin d'aide ?", faqTitle: "Questions fréquentes", contactTitle: "Nous contacter", subject: "Objet", message: "Votre message", attach: "Joindre une capture (JPG/JPEG)", send: "Envoyer", sent: "Message envoyé", sentDesc: "Nous reviendrons vers vous rapidement.", errorEmpty: "Veuillez remplir tous les champs." },
  en: { title: "Need help?", faqTitle: "FAQ", contactTitle: "Contact us", subject: "Subject", message: "Your message", attach: "Attach screenshot (JPG/JPEG)", send: "Send", sent: "Message sent", sentDesc: "We'll get back to you shortly.", errorEmpty: "Please fill all fields." },
  es: { title: "¿Necesita ayuda?", faqTitle: "Preguntas frecuentes", contactTitle: "Contáctenos", subject: "Asunto", message: "Su mensaje", attach: "Adjuntar captura (JPG/JPEG)", send: "Enviar", sent: "Mensaje enviado", sentDesc: "Le responderemos pronto.", errorEmpty: "Complete todos los campos." },
};

export function CocoonHelpModal() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const t = labels[language];
  const faq = faqItems[language];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && /\.(jpe?g)$/i.test(f.name)) {
      setFile(f);
    } else if (f) {
      toast({ title: language === 'en' ? 'Invalid format' : language === 'es' ? 'Formato inválido' : 'Format invalide', description: 'JPG / JPEG', variant: 'destructive' });
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({ title: t.errorEmpty, variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      // Create or find a support conversation
      let conversationId: string | null = null;

      if (user) {
        const { data: existing } = await supabase
          .from('support_conversations')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'open')
          .maybeSingle();

        if (existing) {
          conversationId = existing.id;
        } else {
          const { data: newConv } = await supabase
            .from('support_conversations')
            .insert({ user_id: user.id, subject: `[Cocoon] ${subject}` })
            .select('id')
            .single();
          conversationId = newConv?.id || null;
        }

        if (conversationId) {
          let imageUrl: string | null = null;

          if (file) {
            const ext = file.name.split('.').pop();
            const path = `support/${user.id}/${Date.now()}.${ext}`;
            const { error: uploadErr } = await supabase.storage
              .from('support-attachments')
              .upload(path, file);
            if (!uploadErr) {
              const { data: urlData } = supabase.storage
                .from('support-attachments')
                .getPublicUrl(path);
              imageUrl = urlData?.publicUrl || null;
            }
          }

          await supabase.from('support_messages').insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: `**${subject}**\n\n${message}${imageUrl ? `\n\n![screenshot](${imageUrl})` : ''}`,
            is_admin: false,
          });
        }
      }

      toast({ title: t.sent, description: t.sentDesc });
      setSubject('');
      setMessage('');
      setFile(null);
      setOpen(false);
    } catch {
      toast({ title: language === 'en' ? 'Error' : language === 'es' ? 'Error' : 'Erreur', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs border-[hsl(263,70%,20%)] bg-transparent text-white/60 hover:text-white"
        >
          <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
          {t.title}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <HelpCircle className="h-5 w-5 text-primary" />
            {t.title}
          </DialogTitle>
        </DialogHeader>

        {/* FAQ */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t.faqTitle}</h3>
          <Accordion type="single" collapsible className="space-y-2">
            {faq.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border rounded-lg bg-muted/30 px-4 data-[state=open]:bg-muted/50"
              >
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline py-3">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm pb-3">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Contact form */}
        {user && (
          <div className="space-y-3 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t.contactTitle}</h3>

            <Input
              placeholder={t.subject}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-muted/30 border-border text-sm"
            />

            <Textarea
              placeholder={t.message}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="bg-muted/30 border-border text-sm resize-none"
            />

            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                className="text-xs gap-1.5"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {t.attach}
              </Button>
              {file && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {file.name}
                  <button onClick={() => setFile(null)} className="hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>

            <Button
              onClick={handleSend}
              disabled={sending}
              size="sm"
              className="w-full gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              {t.send}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
