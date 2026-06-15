import { useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, Pause, Play, RotateCcw, Square, X } from 'lucide-react';

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

  useEffect(() => {
    const unsubPlay = window.electronAPI?.onTeleprompterPlay?.(() => {
      if (isDoneRef.current) {
        setOffsetValue(0);
        isDoneRef.current = false;
      }
      startRef.current = null;
      isRunningRef.current = true;
      setIsRunning(true);
      setIsDone(false);
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

  useEffect(() => {
    const frameId = window.requestAnimationFrame(recalculateScrollDistance);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [text, viewportVersion]);

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
    <div className="drag-region relative flex h-full w-full flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-[var(--bg-base)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 h-24 bg-gradient-to-t from-[var(--bg-base)] to-transparent" />

      <div className="absolute right-4 top-4 z-20 no-drag">
        <button
          onClick={() => window.electronAPI?.closeTeleprompter()}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="btn-ghost p-2"
          title="Fechar (ESC)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative z-10 flex flex-1 items-center px-6 pb-6 pt-6">
        <div
          ref={viewportRef}
          className="relative mx-auto h-full w-full max-w-5xl overflow-hidden"
        >
          <div
            ref={contentRef}
            className="no-drag mx-auto max-w-[20ch] whitespace-pre-wrap text-center text-[clamp(2.25rem,4.5vw,4rem)] font-semibold leading-[1.25] tracking-[-0.02em] text-[var(--text-primary)] will-change-transform"
            style={{ transform: `translateY(${offset}px)` }}
          >
            {text}
          </div>
        </div>
      </div>

      {isDone && (
        <div className="absolute inset-0 z-30 flex items-center justify-center no-drag">
          <div className="surface px-5 py-3.5 text-center backdrop-blur-xl">
            <p className="text-sm font-semibold text-indigo-200">
              Roteiro concluído
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Pressione R para voltar ao início
            </p>
          </div>
        </div>
      )}

      <div className="relative z-20 no-drag mx-4 mb-4 space-y-2">
        <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-none"
            style={{ width: `${scrollProgressPercent}%` }}
            role="progressbar"
            aria-valuenow={scrollProgressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da rolagem"
          />
        </div>

        <div className="surface flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-1.5">
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
              className={`btn py-1.5 text-xs ${isRunning ? 'btn-accent' : 'btn-ghost'}`}
              title="Play / Pause (Space)"
            >
              {isRunning ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {isRunning ? 'Pausar' : 'Iniciar'}
            </button>

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
              className="btn-ghost py-1.5 text-xs"
              title="Reiniciar (R)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar
            </button>

            <button
              onClick={() => {
                isDoneRef.current = false;
                isRunningRef.current = false;
                setIsRunning(false);
                setIsDone(false);
                setOffsetValue(0);
                startRef.current = null;
              }}
              className="btn-ghost py-1.5 text-xs"
              title="Parar e voltar ao início"
            >
              <Square className="h-3.5 w-3.5" />
              Parar
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Gauge className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="label-caps">Ritmo</span>
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
              className="range-track w-24"
            />
            <span className="w-8 text-right font-mono text-xs font-semibold tabular-nums">
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
