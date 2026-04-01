import { useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Pause, Play, Square, X } from 'lucide-react';

const DEFAULT_TELEPROMPTER_TEXT =
  'This is the teleprompter text. It will scroll automatically.\n\nYou can customize this text in the Control Panel.\n\nRemember to look at the camera!';
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
    return Math.min(
      Math.max(secondsForWords / speed, MIN_SCROLL_SECONDS),
      MAX_SCROLL_SECONDS
    );
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
        const currentProgress = Math.min(
          Math.abs(offsetRef.current) / distance,
          1
        );
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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#050505] text-white drag-region">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(110,231,249,0.08),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0.22)_20%,rgba(0,0,0,0.22)_80%,rgba(0,0,0,0.72))]" />

      <div className="relative z-10 flex justify-end px-6 pt-6 no-drag">
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
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white transition duration-200 hover:border-white/20 hover:bg-white/[0.10]"
          style={{
            pointerEvents: 'auto',
            userSelect: 'none',
            zIndex: 9999,
          }}
          title="Fechar Teleprompter (ou pressione ESC)"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="relative z-10 flex flex-1 items-center px-8 pb-8 pt-3">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-32 bg-gradient-to-b from-black via-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-8 bottom-0 h-40 bg-gradient-to-t from-black via-black/80 to-transparent" />
        <div
          ref={viewportRef}
          className="relative mx-auto h-full w-full max-w-5xl overflow-hidden px-8"
        >
          <div
            ref={contentRef}
            className="mx-auto max-w-[18ch] whitespace-pre-wrap text-center text-[clamp(2.5rem,4.8vw,4.5rem)] font-semibold leading-[1.22] tracking-[-0.03em] text-slate-50 no-drag will-change-transform"
            style={{ transform: `translateY(${offset}px)` }}
          >
            {text}
          </div>
        </div>
      </div>

      <div
        className="relative z-10 no-drag mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[rgba(12,14,18,0.72)] px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.38)] backdrop-blur-[20px]"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePlay}
            className={`flex items-center gap-2 rounded-[16px] border px-3 py-2 text-sm font-semibold transition duration-200 ${
              isRunning
                ? 'border-cyan-300/30 bg-cyan-300/14 text-cyan-50'
                : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
            }`}
            title="Reproduzir"
          >
            <Play className="h-4 w-4" />
            Play
          </button>
          <button
            onClick={handlePause}
            className={`flex items-center gap-2 rounded-[16px] border px-3 py-2 text-sm font-semibold transition duration-200 ${
              !isRunning
                ? 'border-cyan-300/30 bg-cyan-300/14 text-cyan-50'
                : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
            }`}
            title="Pausar"
          >
            <Pause className="h-4 w-4" />
            Pause
          </button>
          <button
            onClick={handleStop}
            className="flex items-center gap-2 rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 transition duration-200 hover:bg-white/[0.08]"
            title="Parar e voltar ao início"
          >
            <Square className="h-4 w-4" />
            Reset
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
          <Gauge className="h-4 w-4 text-cyan-200" />
          <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Ritmo
          </span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-32"
            title="Velocidade do texto"
          />
          <span className="font-mono w-10 text-right text-sm font-semibold tracking-[0.08em] text-slate-100">
            {speed.toFixed(1)}x
          </span>
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
