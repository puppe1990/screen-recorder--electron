import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const Teleprompter = () => {
  const [text, setText] = useState('This is the teleprompter text. It will scroll automatically.\n\nYou can customize this text in the Control Panel.\n\nRemember to look at the camera!');

  useEffect(() => {
    if (window.electronAPI) {
      const handleTextChange = (newText: string) => {
        setText(newText);
      };
      
      // Register listener
      window.electronAPI.onTeleprompterTextChange(handleTextChange);
      
      // Note: In Electron with contextBridge, listeners are automatically cleaned up
      // but we can't manually remove them. The listener will persist for the window lifetime.
    }

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
    <div className="w-full h-full bg-black/50 text-white p-4 overflow-hidden relative" style={{ WebkitAppRegion: 'drag' }}>
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
        className="absolute top-2 right-2 z-[9999] p-3 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-full transition-all cursor-pointer shadow-lg border-2 border-red-800"
        style={{ 
          WebkitAppRegion: 'no-drag',
          pointerEvents: 'auto',
          userSelect: 'none',
          zIndex: 9999
        }}
        title="Fechar Teleprompter (ou pressione ESC)"
      >
        <X className="w-6 h-6" />
      </button>
      
      <div className="animate-scroll text-2xl font-bold leading-relaxed text-center whitespace-pre-wrap" style={{ WebkitAppRegion: 'drag' }}>
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
      `}</style>
    </div>
  );
};

export default Teleprompter;
