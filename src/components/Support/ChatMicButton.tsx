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
  const [processing, setProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        if (blob.size < 1000) {
          toast({ title: 'Enregistrement trop court', variant: 'destructive' });
          return;
        }

        setProcessing(true);
        try {
          // Use Web Speech API as primary STT (free, no API key needed)
          const text = await transcribeWithWebSpeech(blob);
          if (text) {
            onTranscript(text);
          } else {
            toast({ title: 'Impossible de transcrire', description: 'Réessayez en parlant plus fort.', variant: 'destructive' });
          }
        } catch {
          toast({ title: 'Erreur de transcription', variant: 'destructive' });
        } finally {
          setProcessing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast({
        title: 'Microphone inaccessible',
        description: 'Autorisez l\'accès au micro dans les paramètres du navigateur.',
        variant: 'destructive',
      });
    }
  }, [onTranscript, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
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
      disabled={disabled || processing}
      title={recording ? 'Arrêter l\'enregistrement' : 'Parler au micro'}
    >
      {processing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}

/** Use the Web Speech API (SpeechRecognition) for free STT */
function transcribeWithWebSpeech(_blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      resolve(null);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let result: string | null = null;

    recognition.onresult = (event: any) => {
      result = event.results[0]?.[0]?.transcript || null;
    };

    recognition.onend = () => resolve(result);
    recognition.onerror = () => resolve(null);

    recognition.start();

    // Auto-stop after 15 seconds
    setTimeout(() => {
      try { recognition.stop(); } catch {}
    }, 15000);
  });
}
