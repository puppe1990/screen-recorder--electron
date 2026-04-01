import { useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Pause, Play, RotateCcw, Square } from 'lucide-react';

const DEFAULT_TELEPROMPTER_TEXT =
  'This is the teleprompter text. It will scroll automatically.\n\nYou can customize this text in the Control Panel.\n\nRemember to look at the camera!';
const BASE_WPM = 130;
const MIN_SCROLL_SECONDS = 10;
const MAX_SCROLL_SECONDS = 600;

const Teleprompter = () => {
  const [text, setText] = useState(DEFAULT_TELEPROMPTER_TEXT);
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [isDone, setIsDone] = useState(false);
  const [offset, setOffset] = useState(0);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [viewportVersion, setViewportVersion] = useState(0);
  const [playTrigger, setPlayTrigger] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const isRunningRef = useRef(true);
  const isDoneRef = useRef(false);

  const setOffsetValue = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const recalculateScrollDistance = () => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const naturalDistance = Math.max(
      0,
      content.scrollHeight - viewport.clientHeight
    );

    setScrollDistance(
      naturalDistance > 0 ? naturalDistance : content.scrollHeight
    );
  };

  const duration = useMemo(() => {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const secondsForWords = words > 0 ? (words / BASE_WPM) * 60 : 30;
    return Math.min(
      Math.max(secondsForWords / speed, MIN_SCROLL_SECONDS),
      MAX_SCROLL_SECONDS
    );
  }, [text, speed]);

  const scrollProgressPercent = useMemo(() => {
    if (scrollDistance === 0) return 100;
    return Math.min(Math.round((Math.abs(offset) / scrollDistance) * 100), 100);
  }, [offset, scrollDistance]);

  // Sync text from main process
  useEffect(() => {
    let isMounted = true;

    const syncInitialText = async () => {
      if (!window.electronAPI?.getTeleprompterText) return;
      try {
        const savedText = await window.electronAPI.getTeleprompterText();
        if (isMounted && typeof savedText === 'string') {
          setText(savedText ?? DEFAULT_TELEPROMPTER_TEXT);
          setOffsetValue(0);
          isDoneRef.current = false;
          setIsDone(false);
          startRef.current = null;
        }
      } catch (error) {
        console.error('Failed to load teleprompter text:', error);
      }
    };

    syncInitialText();

    const unsubText = window.electronAPI?.onTeleprompterTextChange
      ? window.electronAPI.onTeleprompterTextChange((newText: string) => {
          if (!isMounted) return;
          setText(newText);
          setOffsetValue(0);
          isDoneRef.current = false;
          setIsDone(false);
          startRef.current = null;
        })
      : undefined;

    return () => {
      isMounted = false;
      unsubText?.();
    };
  }, []);

  // Listen to commands from MiniPanel via IPC
  useEffect(() => {
    const unsubPlay = window.electronAPI?.onTeleprompterPlay?.(() => {
      // If was done, reset to start so animation doesn't immediately re-finish
      if (isDoneRef.current) {
        setOffsetValue(0);
        isDoneRef.current = false;
      }
      startRef.current = null;
      isRunningRef.current = true;
      setIsRunning(true);
      setIsDone(false);
      // Force effect re-run even if isRunning was already true
      setPlayTrigger((n) => n + 1);
    });

    const unsubPause = window.electronAPI?.onTeleprompterPause?.(() => {
      isRunningRef.current = false;
      setIsRunning(false);
    });

    const unsubReset = window.electronAPI?.onTeleprompterReset?.(() => {
      isRunningRef.current = false;
      isDoneRef.current = false;
      setIsRunning(false);
      setIsDone(false);
      setOffsetValue(0);
      startRef.current = null;
    });

    const unsubSpeed = window.electronAPI?.onTeleprompterSetSpeed?.(
      (s: number) => {
        setSpeed(s);
        startRef.current = null;
      }
    );

    return () => {
      unsubPlay?.();
      unsubPause?.();
      unsubReset?.();
      unsubSpeed?.();
    };
  }, []);

  // Keyboard shortcuts: Space = play/pause, R = reset, ESC = close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI?.closeTeleprompter();
      } else if (e.key === ' ') {
        e.preventDefault();
        const next = !isRunningRef.current;
        isRunningRef.current = next;
        if (next) {
          if (isDoneRef.current) {
            setOffsetValue(0);
            isDoneRef.current = false;
          }
          startRef.current = null;
          setIsDone(false);
          setPlayTrigger((n) => n + 1);
        }
        setIsRunning(next);
      } else if (e.key === 'r' || e.key === 'R') {
        isRunningRef.current = false;
        isDoneRef.current = false;
        setIsRunning(false);
        setIsDone(false);
        setOffsetValue(0);
        startRef.current = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Observe viewport resize
  useEffect(() => {
    const target = viewportRef.current;
    if (!target) return;

    const handleResize = () => {
      setViewportVersion((v) => v + 1);
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(target);
    window.addEventListener('resize', handleResize);
    const frameId = window.requestAnimationFrame(handleResize);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Compute scroll distance
  useEffect(() => {
    const frameId = window.requestAnimationFrame(recalculateScrollDistance);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [text, viewportVersion]);

  // Animation loop
  useEffect(() => {
    if (scrollDistance === 0) {
      return;
    }

    const distance = scrollDistance;
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
        // Stop at end, don't loop
        setOffsetValue(-distance);
        setIsRunning(false);
        setIsDone(true);
        isRunningRef.current = false;
        isDoneRef.current = true;
        window.electronAPI?.teleprompterScrollDone?.();
        return;
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
  }, [isRunning, duration, scrollDistance, playTrigger]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#050505] text-white drag-region">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(110,231,249,0.08),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.55),rgba(0,0,0,0.22)_20%,rgba(0,0,0,0.22)_80%,rgba(0,0,0,0.72))]" />

      {/* Top gradient fade */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black via-black/70 to-transparent" />

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black via-black/80 to-transparent" />

      {/* Close button */}
      <div className="absolute right-5 top-5 z-20 no-drag">
        <button
          onClick={() => window.electronAPI?.closeTeleprompter()}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/50 transition duration-200 hover:border-white/20 hover:bg-white/[0.10] hover:text-white"
          title="Fechar (ESC)"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Scrolling text */}
      <div className="relative z-10 flex flex-1 items-center px-8 pb-8 pt-8">
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

      {/* "Done" overlay */}
      {isDone && (
        <div className="absolute inset-0 z-30 flex items-center justify-center no-drag">
          <div className="rounded-[20px] border border-white/10 bg-black/60 px-6 py-4 text-center backdrop-blur-xl">
            <p className="text-sm font-semibold text-cyan-300">
              Roteiro concluído
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Pressione R para voltar ao início
            </p>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="relative z-20 no-drag mx-5 mb-5 space-y-2">
        {/* Progress bar */}
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-400/70 transition-none"
            style={{ width: `${scrollProgressPercent}%` }}
            role="progressbar"
            aria-valuenow={scrollProgressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da rolagem"
          />
        </div>

        {/* Buttons + speed */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[rgba(12,14,18,0.80)] px-4 py-2.5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            {/* Play / Pause */}
            <button
              onClick={() => {
                if (isRunning) {
                  isRunningRef.current = false;
                  setIsRunning(false);
                } else {
                  if (isDoneRef.current) {
                    setOffsetValue(0);
                    isDoneRef.current = false;
                  }
                  startRef.current = null;
                  isRunningRef.current = true;
                  setIsRunning(true);
                  setIsDone(false);
                  setPlayTrigger((n) => n + 1);
                }
              }}
              className={`flex items-center gap-2 rounded-[14px] border px-3 py-1.5 text-sm font-semibold transition duration-200 ${
                isRunning
                  ? 'border-cyan-300/30 bg-cyan-300/14 text-cyan-50'
                  : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
              }`}
              title="Play / Pause (Space)"
            >
              {isRunning ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning ? 'Pausar' : 'Iniciar'}
            </button>

            {/* Restart */}
            <button
              onClick={() => {
                isDoneRef.current = false;
                setOffsetValue(0);
                startRef.current = null;
                isRunningRef.current = true;
                setIsRunning(true);
                setIsDone(false);
                setPlayTrigger((n) => n + 1);
              }}
              className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-slate-200 transition duration-200 hover:bg-white/[0.08]"
              title="Reiniciar (R)"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar
            </button>

            {/* Stop */}
            <button
              onClick={() => {
                isDoneRef.current = false;
                isRunningRef.current = false;
                setIsRunning(false);
                setIsDone(false);
                setOffsetValue(0);
                startRef.current = null;
              }}
              className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-slate-200 transition duration-200 hover:bg-white/[0.08]"
              title="Parar e voltar ao início"
            >
              <Square className="h-4 w-4" />
              Parar
            </button>
          </div>

          {/* Speed */}
          <div className="flex items-center gap-2 text-sm text-white">
            <Gauge className="h-4 w-4 text-cyan-200" />
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Ritmo
            </span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speed}
              onChange={(e) => {
                setSpeed(Number(e.target.value));
                startRef.current = null;
              }}
              aria-label="Velocidade de rolagem"
              className="w-28"
            />
            <span className="w-9 text-right font-mono text-sm font-semibold text-slate-100">
              {speed.toFixed(1)}x
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .drag-region { -webkit-app-region: drag; }
        .no-drag { -webkit-app-region: no-drag; }
      `}</style>
    </div>
  );
};

export default Teleprompter;
