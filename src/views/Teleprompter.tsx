import { useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Pause, Play, Square, X } from 'lucide-react';

const DEFAULT_TELEPROMPTER_TEXT = 'This is the teleprompter text. It will scroll automatically.\n\nYou can customize this text in the Control Panel.\n\nRemember to look at the camera!';
const BASE_WPM = 130; // baseline reading speed
const MIN_SCROLL_SECONDS = 10;
const MAX_SCROLL_SECONDS = 600;

const Teleprompter = () => {
  const [text, setText] = useState(DEFAULT_TELEPROMPTER_TEXT);
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [offset, setOffset] = useState(0);
  const [viewportVersion, setViewportVersion] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const setOffsetValue = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };
  const duration = useMemo(() => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const secondsForWords = words > 0 ? (words / BASE_WPM) * 60 : 30;
    return Math.min(Math.max(secondsForWords / speed, MIN_SCROLL_SECONDS), MAX_SCROLL_SECONDS);
  }, [text, speed]);

  useEffect(() => {
    let isMounted = true;
    const handleTextChange = (newText: string) => {
      if (!isMounted) return;
      setText(newText);
      setOffsetValue(0);
      startRef.current = null;
    };

    const syncInitialText = async () => {
      if (!window.electronAPI?.getTeleprompterText) return;
      try {
        const savedText = await window.electronAPI.getTeleprompterText();
        if (isMounted && typeof savedText === 'string') {
          setText(savedText ?? DEFAULT_TELEPROMPTER_TEXT);
          setOffsetValue(0);
          startRef.current = null;
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
        window.electronAPI?.closeTeleprompter();
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
    setOffsetValue(0); // reset posição
    startRef.current = null;
  };

  // Observa redimensionamento do container para recalcular distância de rolagem
  useEffect(() => {
    const target = viewportRef.current;
    if (!target) return;

    const observer = new ResizeObserver(() => {
      setViewportVersion((v) => v + 1);
    });
    observer.observe(target);

    return () => observer.disconnect();
  }, []);

  // Anima a rolagem com base em pixels para evitar saltos de velocidade em textos longos/curtos
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const viewportHeight = viewport.clientHeight;
    const contentHeight = content.scrollHeight;
    const distance = Math.max(0, contentHeight - viewportHeight);

    if (distance === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOffsetValue(0);
      return;
    }

    const durationMs = duration * 1000;

    const animate = (timestamp: number) => {
      if (startRef.current === null) {
        const currentProgress = Math.min(Math.abs(offsetRef.current) / distance, 1);
        startRef.current = timestamp - currentProgress * durationMs;
      }

      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      const newOffset = -distance * progress;

      if (newOffset !== offsetRef.current) {
        setOffsetValue(newOffset);
      }

      if (progress >= 1) {
        setOffsetValue(0); // volta ao topo
        startRef.current = timestamp; // reinicia ciclo
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    if (isRunning) {
      frameRef.current = requestAnimationFrame(animate);
    } else {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      startRef.current = null;
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      startRef.current = null;
    };
  }, [isRunning, duration, text, viewportVersion]);

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI?.closeTeleprompter();
  };

  return (
    <div className="w-full h-full bg-black/60 text-white p-5 overflow-hidden relative flex flex-col gap-4 drag-region">
      <div className="flex justify-end no-drag">
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
          className="p-3 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-full transition-all cursor-pointer shadow-lg border-2 border-red-800"
          style={{ 
            pointerEvents: 'auto',
            userSelect: 'none',
            zIndex: 9999
          }}
          title="Fechar Teleprompter (ou pressione ESC)"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div
        ref={viewportRef}
        className="flex-1 overflow-hidden relative rounded-2xl border border-white/10 bg-black/40 px-8 py-6"
      >
        <div
          ref={contentRef}
          className="text-3xl font-bold leading-relaxed text-center whitespace-pre-wrap no-drag will-change-transform"
          style={{ transform: `translateY(${offset}px)` }}
        >
          {text}
        </div>
      </div>

      {/* Controls */}
      <div className="no-drag flex flex-wrap items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 shadow-lg backdrop-blur-md"
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
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white">
          <Gauge className="w-4 h-4" />
          <span className="text-xs text-slate-200">Velocidade</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-32 accent-purple-400"
            title="Velocidade do texto"
          />
          <span className="font-semibold w-10 text-right">{speed.toFixed(1)}x</span>
        </div>
      </div>
      <style>{`
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
