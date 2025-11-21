import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const DEFAULT_TELEPROMPTER_TEXT = 'This is the teleprompter text. It will scroll automatically.\n\nYou can customize this text in the Control Panel.\n\nRemember to look at the camera!';

const Teleprompter = () => {
  const [text, setText] = useState(DEFAULT_TELEPROMPTER_TEXT);

  useEffect(() => {
    let isMounted = true;
    const handleTextChange = (newText: string) => {
      if (!isMounted) return;
      setText(newText);
    };

    const syncInitialText = async () => {
      if (!window.electronAPI?.getTeleprompterText) return;
      try {
        const savedText = await window.electronAPI.getTeleprompterText();
        if (isMounted && typeof savedText === 'string') {
          setText(savedText ?? DEFAULT_TELEPROMPTER_TEXT);
        }
      } catch (error) {
        console.error('Failed to load teleprompter text:', error);
      }
    };

    syncInitialText();

    const unsubscribe = window.electronAPI?.onTeleprompterTextChange
      ? window.electronAPI.onTeleprompterTextChange(handleTextChange)
      : undefined;

    // Add keyboard shortcut to close (ESC key)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('ESC key pressed, closing teleprompter');
        if (window.electronAPI) {
          window.electronAPI.closeTeleprompter();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      unsubscribe?.();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Close button clicked');
    if (window.electronAPI) {
      console.log('Calling closeTeleprompter');
      window.electronAPI.closeTeleprompter();
    } else {
      console.error('electronAPI not available');
    }
  };

  return (
    <div className="w-full h-full bg-black/50 text-white p-4 overflow-hidden relative drag-region">
      {/* Close button */}
      <button
        onClick={handleClose}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="absolute top-2 right-2 z-[9999] p-3 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-full transition-all cursor-pointer shadow-lg border-2 border-red-800 no-drag"
        style={{ 
          pointerEvents: 'auto',
          userSelect: 'none',
          zIndex: 9999
        }}
        title="Fechar Teleprompter (ou pressione ESC)"
      >
        <X className="w-6 h-6" />
      </button>
      
      <div className="animate-scroll text-2xl font-bold leading-relaxed text-center whitespace-pre-wrap drag-region">
        {text}
      </div>
      <style>{`
        @keyframes scroll {
          0% { transform: translateY(100%); }
          100% { transform: translateY(-100%); }
        }
        .animate-scroll {
          animation: scroll 20s linear infinite;
        }
        .drag-region {
          -webkit-app-region: drag;
        }
        .no-drag {
          -webkit-app-region: no-drag;
        }
      `}</style>
    </div>
  );
};

export default Teleprompter;
