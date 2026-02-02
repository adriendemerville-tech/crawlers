import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatWindow } from './ChatWindow';
import { useIsMobile } from '@/hooks/use-mobile';

export function FloatingChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <>
      {/* Chat Window */}
      {isOpen && <ChatWindow onClose={() => setIsOpen(false)} />}

      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200"
        size="icon"
        aria-label={isOpen ? 'Fermer le chat' : 'Ouvrir le chat support'}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </>
  );
}
