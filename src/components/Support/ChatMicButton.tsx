import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ChatMicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  /** Compact mode for chat inputs (smaller size) */
  compact?: boolean;
}

export function ChatMicButton({ onTranscript, disabled, compact = true }: ChatMicButtonProps) {
  const { toast } = useToast();
  const [recording, setRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const recognitionRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  // Audio level monitoring via Web Audio API
  const startAudioMonitor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(1, avg / 128));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Silently fail — glow just won't react
    }
  }, []);

  const stopAudioMonitor = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    analyserRef.current = null;
    audioCtxRef.current = null;
    streamRef.current = null;
    setAudioLevel(0);
  }, []);

  useEffect(() => () => stopAudioMonitor(), [stopAudioMonitor]);

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
      stopAudioMonitor();
      if (fullTranscript.trim()) {
        onTranscript(fullTranscript.trim());
      }
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      setRecording(false);
      stopAudioMonitor();
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
    startAudioMonitor();
  }, [onTranscript, toast, startAudioMonitor, stopAudioMonitor]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setRecording(false);
    stopAudioMonitor();
  }, [stopAudioMonitor]);

  // Glow parameters — same style as FlameButton in SiteIdentityModal
  const glowSize = recording ? 6 + audioLevel * 16 : 0;
  const glowOpacity = recording ? 0.25 + audioLevel * 0.45 : 0;
  const size = compact ? 'h-8 w-8' : 'h-10 w-10';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div className="relative shrink-0">
      {/* Voice-reactive glow layers */}
      {recording && (
        <>
          <div
            className="absolute inset-0 rounded-full transition-all duration-200 pointer-events-none"
            style={{
              boxShadow: `0 0 ${glowSize}px ${glowSize / 2}px hsla(262, 83%, 58%, ${glowOpacity * 0.6}), 0 0 ${glowSize * 1.5}px ${glowSize}px hsla(30, 90%, 55%, ${glowOpacity * 0.4})`,
            }}
          />
          <div
            className="absolute -inset-0.5 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, hsla(30, 90%, 55%, ${glowOpacity * 0.25}) 0%, hsla(262, 83%, 58%, ${glowOpacity * 0.15}) 60%, transparent 100%)`,
              transform: `scale(${1 + audioLevel * 0.25})`,
              transition: 'transform 150ms ease-out, background 150ms ease-out',
            }}
          />
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        className={`relative rounded-full transition-all duration-300 ${size} ${
          recording
            ? 'bg-gradient-to-br from-[hsl(262,83%,58%)] via-[hsl(300,70%,50%)] to-[hsl(30,90%,55%)] text-white shadow-md border-0 hover:opacity-90'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled}
        title={recording ? 'Arrêter l\'enregistrement' : 'Parler au micro'}
      >
        {recording ? (
          <MicOff className={iconSize} />
        ) : (
          <Mic className={iconSize} />
        )}
      </Button>
    </div>
  );
}
