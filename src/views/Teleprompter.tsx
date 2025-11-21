import { useEffect, useState } from 'react';
import { Gauge, Pause, Play, Square, X } from 'lucide-react';

const DEFAULT_TELEPROMPTER_TEXT = 'This is the teleprompter text. It will scroll automatically.\n\nYou can customize this text in the Control Panel.\n\nRemember to look at the camera!';
const BASE_SCROLL_DURATION = 20; // seconds at 1x speed
const MIN_SCROLL_DURATION = 6; // avoid absurd speeds

const Teleprompter = () => {
  const [text, setText] = useState(DEFAULT_TELEPROMPTER_TEXT);
  const [isRunning, setIsRunning] = useState(true);
  const [scrollCycle, setScrollCycle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const effectiveDuration = Math.max(MIN_SCROLL_DURATION, BASE_SCROLL_DURATION / speed);

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

  const handlePlay = () => {
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = () => {
    setIsRunning(false);
    setScrollCycle((cycle) => cycle + 1); // reset posição
  };

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
      
      <div
        key={scrollCycle}
        className="text-2xl font-bold leading-relaxed text-center whitespace-pre-wrap drag-region"
        style={{
          animation: `scroll ${effectiveDuration}s linear infinite`,
          animationPlayState: isRunning ? 'running' : 'paused',
        }}
      >
        {text}
      </div>

      {/* Controls overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center gap-2 bg-black/50 border border-white/10 rounded-2xl px-4 py-2 shadow-xl backdrop-blur-md no-drag"
        style={{ pointerEvents: 'auto' }}>
        <button
          onClick={handlePlay}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
          title="Reproduzir"
        >
          <Play className="w-4 h-4" />
          Play
        </button>
        <button
          onClick={handlePause}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
          title="Pausar"
        >
          <Pause className="w-4 h-4" />
          Pause
        </button>
        <button
          onClick={handleStop}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors"
          title="Parar e voltar ao início"
        >
          <Square className="w-4 h-4" />
          Stop
        </button>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white">
          <Gauge className="w-4 h-4" />
          <span className="text-xs text-slate-200">Velocidade</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-28 accent-purple-400"
            title="Velocidade do texto"
          />
          <span className="font-semibold">{speed.toFixed(1)}x</span>
        </div>
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
