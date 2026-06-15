import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  Play,
  Pause,
  Download,
  X,
  Video,
  Rewind,
  FastForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { VideoFormat } from '../../electron/ipc-contract';

interface PreviewPlayerProps {
  videoBlob: Blob;
  onSave: (format: VideoFormat) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  saveError?: string | null;
  initialFormat?: VideoFormat;
}

const PreviewPlayer = ({
  videoBlob,
  onSave,
  onCancel,
  isSaving,
  saveError,
  initialFormat = 'mp4',
}: PreviewPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isResolvingDurationRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedFormat, setSelectedFormat] =
    useState<VideoFormat>(initialFormat);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [resolution, setResolution] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const videoUrl = useMemo(() => URL.createObjectURL(videoBlob), [videoBlob]);

  const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties;

  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const resolveVideoDuration = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const valid = (v: number) => Number.isFinite(v) && v > 0 && v !== Infinity;

    if (valid(video.duration)) {
      setDuration(video.duration);
      return;
    }

    isResolvingDurationRef.current = true;
    const fix = () => {
      if (!videoRef.current) return;
      const d = videoRef.current.duration;
      if (!valid(d)) return;
      videoRef.current.removeEventListener('timeupdate', fix);
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      setDuration(d);
      isResolvingDurationRef.current = false;
    };
    video.addEventListener('timeupdate', fix);
    video.currentTime = 1e9;
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else void videoRef.current.play();
  };

  const handleGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isSaving) return;

    if (event.key === 'Escape') {
      setShowDiscardConfirm(true);
      return;
    }

    if (event.key === ' ' && !showDiscardConfirm) {
      event.preventDefault();
      handlePlayPause();
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      handleGlobalKeyDown(event);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSeek = (value: number) => {
    if (!videoRef.current) return;
    const t = Math.min(Math.max(value, 0), videoRef.current.duration || 0);
    videoRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const handleSkip = (amount: number) => {
    if (videoRef.current) handleSeek(videoRef.current.currentTime + amount);
  };

  const handleSave = async () => {
    videoRef.current?.pause();
    await onSave(selectedFormat);
  };

  const sizeLabel = () => {
    const mb = videoBlob.size / (1024 * 1024);
    return mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
  };

  const progressPercent = duration
    ? Math.min((currentTime / duration) * 100, 100)
    : 0;

  const formatLabel = (f: VideoFormat) =>
    f === 'webm-vp9' ? 'VP9' : f === 'webm-vp8' ? 'VP8' : 'MP4';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-base)]">
      <header
        className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3"
        style={{ WebkitAppRegion: 'drag' } as CSSProperties}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-control border border-[var(--accent-border)] bg-[var(--accent-muted)]">
            <Video className="h-4 w-4 text-indigo-200" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Preview da gravação
            </span>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              {resolution && <span>{resolution}</span>}
              {resolution && <span>·</span>}
              <span>{sizeLabel()}</span>
              {duration > 0 && (
                <>
                  <span>·</span>
                  <span>{formatTime(duration)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => !isSaving && setShowDiscardConfirm(true)}
          style={noDrag}
          className="btn-ghost p-2"
          title="Fechar (ESC)"
          aria-label="Fechar preview"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-contain"
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (videoRef.current && !isResolvingDurationRef.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (!videoRef.current) return;
            setResolution(
              `${videoRef.current.videoWidth}×${videoRef.current.videoHeight}`
            );
            resolveVideoDuration();
          }}
        />
      </div>

      <div className="shrink-0 border-t border-[var(--border-subtle)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="w-10 text-right font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
            {formatTime(currentTime)}
          </span>
          <div className="relative flex-1">
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={duration ? currentTime : 0}
              step="0.1"
              onChange={(e) => handleSeek(Number(e.target.value))}
              aria-label="Posição do vídeo"
              className="range-track relative z-10"
              style={noDrag}
            />
            <div className="pointer-events-none absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-[var(--bg-muted)]" />
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--accent)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="w-10 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
            {formatTime(duration || 0)}
          </span>
        </div>
      </div>

      <footer
        className="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-[var(--border-subtle)] px-4 py-3"
        style={noDrag}
      >
        <div className="surface-inset flex items-center gap-1 p-1">
          <button
            onClick={() => handleSkip(-10)}
            className="btn-ghost px-2.5 py-1.5 text-xs"
            title="Voltar 10s"
          >
            <Rewind className="h-3.5 w-3.5" />
            10s
          </button>
          <button
            onClick={handlePlayPause}
            className={`btn px-3 py-1.5 text-xs ${isPlaying ? 'btn-stop' : 'btn-record'}`}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isPlaying ? 'Pausar' : 'Play'}
          </button>
          <button
            onClick={() => handleSkip(10)}
            className="btn-ghost px-2.5 py-1.5 text-xs"
            title="Avançar 10s"
          >
            10s
            <FastForward className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={() => setIsMuted((m) => !m)}
          className="btn-ghost p-2"
          title={isMuted ? 'Ativar áudio' : 'Silenciar'}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1" />

        {saveError && <span className="text-xs text-red-300">{saveError}</span>}

        <div className="surface-inset flex items-center gap-0.5 p-1">
          {(['webm-vp9', 'webm-vp8', 'mp4'] as VideoFormat[]).map((fmt) => (
            <button
              key={fmt}
              type="button"
              data-testid={`preview-format-${fmt}`}
              onClick={() => setSelectedFormat(fmt)}
              style={noDrag}
              className={`btn px-3 py-1.5 text-xs ${
                selectedFormat === fmt
                  ? 'btn-accent'
                  : 'border-transparent bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {formatLabel(fmt)}
            </button>
          ))}
        </div>

        <button
          onClick={() => !isSaving && setShowDiscardConfirm(true)}
          disabled={isSaving}
          className="btn-ghost px-3 py-2 text-xs"
        >
          Descartar
        </button>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-record px-4 py-2 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          {isSaving
            ? selectedFormat === 'mp4'
              ? 'Convertendo...'
              : 'Salvando...'
            : `Salvar ${formatLabel(selectedFormat)}`}
        </button>
      </footer>

      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-dialog-title"
        >
          <div className="surface w-full max-w-sm p-5 shadow-panel">
            <h3
              id="discard-dialog-title"
              className="text-base font-semibold text-[var(--text-primary)]"
            >
              Descartar gravação?
            </h3>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              A gravação não foi salva e será perdida permanentemente.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onCancel();
                }}
                className="btn-stop flex-1 py-2.5 text-sm"
              >
                Descartar
              </button>
              <button
                onClick={() => setShowDiscardConfirm(false)}
                autoFocus
                className="btn-ghost flex-1 py-2.5 text-sm"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewPlayer;
