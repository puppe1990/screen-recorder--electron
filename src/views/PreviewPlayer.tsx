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
}

const PreviewPlayer = ({
  videoBlob,
  onSave,
  onCancel,
  isSaving,
  saveError,
}: PreviewPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isResolvingDurationRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat>('webm-vp9');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [resolution, setResolution] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const videoUrl = useMemo(() => URL.createObjectURL(videoBlob), [videoBlob]);

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
    <div className="fixed inset-0 z-50 flex flex-col bg-[linear-gradient(160deg,rgba(10,12,17,0.99),rgba(6,8,12,0.99))]">
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-2.5"
        style={{ WebkitAppRegion: 'drag' } as CSSProperties}
      >
        <div className="flex items-center gap-2.5">
          <div className="rounded-[12px] border border-cyan-300/20 bg-cyan-300/10 p-1.5">
            <Video className="h-4 w-4 text-cyan-200" />
          </div>
          <span className="text-sm font-semibold text-white">
            Preview da Gravação
          </span>
          {resolution && (
            <span className="text-xs text-slate-500">{resolution}</span>
          )}
          <span className="text-xs text-slate-500">{sizeLabel()}</span>
          {duration > 0 && (
            <span className="text-xs text-slate-500">
              {formatTime(duration)}
            </span>
          )}
        </div>
        <button
          onClick={() => !isSaving && setShowDiscardConfirm(true)}
          style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
          className="rounded-full border border-white/10 bg-white/[0.04] p-1.5 text-slate-400 transition hover:bg-white/[0.08]"
          title="Fechar (ESC)"
          aria-label="Fechar preview"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Video */}
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

      {/* Seek bar */}
      <div className="shrink-0 border-t border-white/6 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="w-10 text-right font-mono text-[11px] text-slate-400">
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
              className="relative z-10 w-full cursor-pointer bg-transparent"
              style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
            />
            <div className="pointer-events-none absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2 rounded-full bg-white/10" />
            <div
              className="pointer-events-none absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-cyan-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="w-10 font-mono text-[11px] text-slate-500">
            {formatTime(duration || 0)}
          </span>
        </div>
      </div>

      {/* Controls bar */}
      <div
        className="flex shrink-0 items-center gap-3 border-t border-white/8 px-4 py-2.5"
        style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
      >
        {/* Playback controls */}
        <div className="flex items-center gap-1 rounded-[16px] border border-white/8 bg-white/[0.04] p-1">
          <button
            onClick={() => handleSkip(-10)}
            className="flex items-center gap-1 rounded-[12px] border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]"
            title="Voltar 10s"
          >
            <Rewind className="h-3.5 w-3.5" />
            10s
          </button>
          <button
            onClick={handlePlayPause}
            className={`flex items-center gap-1.5 rounded-[12px] px-3.5 py-1.5 text-xs font-semibold transition ${
              isPlaying
                ? 'bg-[linear-gradient(135deg,#FF5D73,#D92D4A)] text-white'
                : 'bg-[linear-gradient(135deg,#6EE7F9,#35B8D6)] text-slate-950'
            }`}
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
            className="flex items-center gap-1 rounded-[12px] border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]"
            title="Avançar 10s"
          >
            10s
            <FastForward className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Mute */}
        <button
          onClick={() => setIsMuted((m) => !m)}
          className="rounded-[12px] border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white/[0.08]"
          title={isMuted ? 'Ativar áudio' : 'Silenciar'}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1" />

        {saveError && (
          <span className="text-xs text-rose-300">{saveError}</span>
        )}

        {/* Format selector */}
        <div className="flex items-center gap-1 rounded-[16px] border border-white/8 bg-white/[0.04] p-1">
          {(['webm-vp9', 'webm-vp8', 'mp4'] as VideoFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setSelectedFormat(fmt)}
              className={`rounded-[12px] px-3 py-1.5 text-xs font-semibold transition ${
                selectedFormat === fmt
                  ? 'border border-cyan-300/25 bg-cyan-300/14 text-cyan-50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {formatLabel(fmt)}
            </button>
          ))}
        </div>

        {/* Discard */}
        <button
          onClick={() => !isSaving && setShowDiscardConfirm(true)}
          disabled={isSaving}
          className="rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          Descartar
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-[14px] bg-[linear-gradient(135deg,#6EE7F9,#35B8D6)] px-4 py-2 text-xs font-bold text-slate-950 shadow-[0_8px_20px_rgba(110,231,249,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          {isSaving
            ? selectedFormat === 'mp4'
              ? 'Convertendo...'
              : 'Salvando...'
            : `Salvar ${formatLabel(selectedFormat)}`}
        </button>
      </div>

      {/* Discard confirm */}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-dialog-title"
        >
          <div className="w-full max-w-xs rounded-[20px] border border-white/10 bg-[rgba(12,15,20,0.98)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <h3
              id="discard-dialog-title"
              className="text-base font-semibold text-white"
            >
              Descartar gravação?
            </h3>
            <p className="mt-1.5 text-sm text-slate-400">
              A gravação não foi salva e será perdida permanentemente.
            </p>
            <div className="mt-4 flex gap-2.5">
              <button
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onCancel();
                }}
                className="flex-1 rounded-[14px] border border-[#FF5D73]/40 bg-[#FF5D73]/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-[#FF5D73]/16"
              >
                Descartar
              </button>
              <button
                onClick={() => setShowDiscardConfirm(false)}
                autoFocus
                className="flex-1 rounded-[14px] border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.10]"
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
