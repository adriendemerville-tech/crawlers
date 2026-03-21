import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChatMicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function ChatMicButton({ onTranscript, disabled }: ChatMicButtonProps) {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: 'Non supporté',
        description: 'Votre navigateur ne supporte pas la reconnaissance vocale. Utilisez Chrome ou Edge.',
        variant: 'destructive',
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language?.startsWith('en') ? 'en-US' : navigator.language?.startsWith('es') ? 'es-ES' : 'fr-FR';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let fullTranscript = '';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          fullTranscript += (fullTranscript ? ' ' : '') + event.results[i][0].transcript;
        }
      }
    };

    recognition.onend = () => {
      setRecording(false);
      if (fullTranscript.trim()) {
        onTranscript(fullTranscript.trim());
      }
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      setRecording(false);
      recognitionRef.current = null;
      if (event.error === 'not-allowed') {
        toast({
          title: 'Microphone inaccessible',
          description: 'Autorisez l\'accès au micro dans les paramètres du navigateur.',
          variant: 'destructive',
        });
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [onTranscript, toast]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setRecording(false);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'h-10 w-10 shrink-0 transition-colors',
        recording && 'bg-destructive/10 text-destructive animate-pulse'
      )}
      onClick={recording ? stopRecording : startRecording}
      disabled={disabled}
      title={recording ? 'Arrêter l\'enregistrement' : 'Parler au micro'}
    >
      {recording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
