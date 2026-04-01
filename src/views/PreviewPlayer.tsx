import { useEffect, useMemo, useRef, useState } from 'react';
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
  Gauge,
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
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [resolution, setResolution] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const videoUrl = useMemo(() => URL.createObjectURL(videoBlob), [videoBlob]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        setShowDiscardConfirm(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving]);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const resolveVideoDuration = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const validDuration = (value: number) =>
      Number.isFinite(value) && value > 0 && value !== Infinity;

    if (validDuration(video.duration)) {
      setDuration(video.duration);
      return;
    }

    isResolvingDurationRef.current = true;

    const handleDurationFix = () => {
      if (!videoRef.current) return;

      const fixedDuration = videoRef.current.duration;
      if (!validDuration(fixedDuration)) return;

      videoRef.current.removeEventListener('timeupdate', handleDurationFix);
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      setDuration(fixedDuration);
      isResolvingDurationRef.current = false;
    };

    video.addEventListener('timeupdate', handleDurationFix);
    video.currentTime = 1000000000;
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
  };

  const handleCancel = () => {
    if (isSaving) return;
    setShowDiscardConfirm(true);
  };

  const handleSave = async () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    await onSave(selectedFormat);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isResolvingDurationRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeek = (value: number) => {
    if (!videoRef.current) return;
    const safeTime = Math.min(
      Math.max(value, 0),
      videoRef.current.duration || 0
    );
    videoRef.current.currentTime = safeTime;
    setCurrentTime(safeTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setResolution(
      `${videoRef.current.videoWidth} x ${videoRef.current.videoHeight}`
    );
    resolveVideoDuration();
  };

  const handleSkip = (amount: number) => {
    if (!videoRef.current) return;
    handleSeek(videoRef.current.currentTime + amount);
  };

  const handleToggleMute = () => {
    setIsMuted((mute) => !mute);
  };

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    if (value > 0) {
      setIsMuted(false);
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
  };

  const sizeLabel = () => {
    const sizeInMB = videoBlob.size / (1024 * 1024);
    if (sizeInMB > 1024) {
      return `${(sizeInMB / 1024).toFixed(2)} GB`;
    }
    return `${sizeInMB.toFixed(1)} MB`;
  };

  const progressPercent = duration
    ? Math.min((currentTime / duration) * 100, 100)
    : 0;
  const playbackRates = [0.75, 1, 1.25, 1.5, 2];
  const controlChipClass =
    'rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200 transition duration-200 hover:bg-white/[0.08]';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(3,5,7,0.88)] p-6 backdrop-blur-md"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div className="min-h-full flex items-center justify-center py-6">
        <div className="w-full max-w-6xl rounded-[30px] border border-white/8 bg-[linear-gradient(160deg,rgba(12,15,20,0.98),rgba(8,10,15,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.52)]">
          <div className="flex items-center justify-between border-b border-white/8 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-[18px] border border-cyan-300/20 bg-cyan-300/10 p-2">
                <Video className="h-6 w-6 text-cyan-200" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white">
                  Preview da Gravação
                </h2>
                <p className="text-slate-400 text-sm">
                  Revise o vídeo antes de salvar
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition duration-200 hover:bg-white/[0.08]"
              title="Fechar preview (ESC)"
              aria-label="Fechar preview"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr),320px]">
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[28px] border border-white/8 bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="aspect-video flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(110,231,249,0.08),transparent_35%),#020304]">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="h-full w-full object-contain"
                    onEnded={handleVideoEnd}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center gap-3">
                  <span className="w-14 text-right font-mono text-xs text-slate-300">
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
                      aria-valuemin={0}
                      aria-valuemax={duration || 0}
                      aria-valuenow={currentTime}
                      aria-valuetext={formatTime(currentTime)}
                      className="relative z-10 w-full bg-transparent"
                    />
                    <div className="pointer-events-none absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2 rounded-full bg-white/10" />
                    <div
                      className="pointer-events-none absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-cyan-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="w-14 font-mono text-xs text-slate-400">
                    {formatTime(duration || 0)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-[20px] border border-white/8 bg-white/[0.04] p-2">
                  <button
                    onClick={() => handleSkip(-10)}
                    className={controlChipClass}
                    title="Voltar 10s"
                  >
                    <Rewind className="w-5 h-5" />
                    <span className="text-sm font-semibold">10s</span>
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className={`rounded-[18px] px-4 py-2 text-sm font-semibold transition duration-200 ${
                      isPlaying
                        ? 'bg-[linear-gradient(135deg,#FF5D73,#D92D4A)] text-white shadow-[0_16px_30px_rgba(255,93,115,0.24)]'
                        : 'bg-[linear-gradient(135deg,#6EE7F9,#35B8D6)] text-slate-950 shadow-[0_16px_30px_rgba(110,231,249,0.22)]'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-5 h-5 text-white" />
                        <span className="text-white">Pausar</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        <span>Reproduzir</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleSkip(10)}
                    className={controlChipClass}
                    title="Avançar 10s"
                  >
                    <span className="text-sm font-semibold">10s</span>
                    <FastForward className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-white/[0.04] px-3 py-2.5">
                  <button
                    onClick={handleToggleMute}
                    className="rounded-[16px] border border-white/10 bg-white/[0.04] p-2.5 text-slate-200 transition duration-200 hover:bg-white/[0.08]"
                    title={isMuted ? 'Reativar áudio' : 'Silenciar áudio'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    aria-label="Volume"
                    className="w-32"
                  />
                  <span className="w-10 text-right font-mono text-xs text-slate-300">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-[20px] border border-white/8 bg-white/[0.04] px-3 py-2.5">
                  <Gauge className="h-4 w-4 text-cyan-200" />
                  {playbackRates.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleRateChange(rate)}
                      className={`rounded-[16px] px-3 py-2 text-sm font-semibold transition duration-200 ${
                        playbackRate === rate
                          ? 'bg-cyan-300/14 text-cyan-50'
                          : 'bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Exportar
                </p>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-white">
                  Salve a melhor versão
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Escolha o formato final depois de revisar imagem, áudio e
                  ritmo.
                </p>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <label className="mb-3 block text-sm font-semibold text-slate-300">
                  Formato de saída
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {(['webm-vp9', 'webm-vp8', 'mp4'] as VideoFormat[]).map(
                    (format) => (
                      <button
                        key={format}
                        onClick={() => setSelectedFormat(format)}
                        className={`rounded-[20px] border p-4 text-left transition duration-200 ${
                          selectedFormat === format
                            ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-50'
                            : 'border-white/10 bg-black/20 text-slate-300 hover:border-white/18'
                        }`}
                      >
                        <div className="mb-1 font-semibold">
                          {format === 'webm-vp9' && 'WebM (VP9)'}
                          {format === 'webm-vp8' && 'WebM (VP8)'}
                          {format === 'mp4' && 'MP4 (H.264)'}
                        </div>
                        <div className="text-xs text-slate-400">
                          {format === 'webm-vp9' &&
                            'Melhor qualidade, salva rápido'}
                          {format === 'webm-vp8' &&
                            'Boa compatibilidade com navegadores'}
                          {format === 'mp4' &&
                            'Compatível com tudo — requer conversão via FFmpeg (demora mais)'}
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm text-slate-300">
                <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Duração
                  </p>
                  <p className="mt-2 font-mono text-base font-semibold text-white">
                    {duration ? formatTime(duration) : 'Carregando...'}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Resolução
                  </p>
                  <p className="mt-2 font-semibold text-white">
                    {resolution || 'Detectando...'}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Tamanho
                  </p>
                  <p className="mt-2 font-semibold text-white">{sizeLabel()}</p>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Origem
                  </p>
                  <p className="mt-2 font-semibold text-white">
                    {videoBlob.type || 'WebM'}
                  </p>
                </div>
              </div>

              {saveError && (
                <div className="rounded-[20px] border border-[#FF5D73]/40 bg-[#FF5D73]/10 px-4 py-3 text-sm text-rose-100">
                  {saveError}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex h-12 items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#6EE7F9,#35B8D6)] px-6 text-sm font-bold text-slate-950 shadow-[0_18px_36px_rgba(110,231,249,0.24)] transition duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="w-5 h-5" />
                  {isSaving
                    ? `Salvando${selectedFormat === 'mp4' ? ' (convertendo...)' : '...'}`
                    : `Salvar como ${selectedFormat === 'webm-vp9' ? 'WebM VP9' : selectedFormat === 'webm-vp8' ? 'WebM VP8' : 'MP4'}`}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="rounded-[18px] border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-white/[0.08]"
                >
                  {isSaving ? 'Salvando...' : 'Descartar gravação'}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-dialog-title"
        >
          <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[rgba(12,15,20,0.98)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <h3
              id="discard-dialog-title"
              className="text-lg font-semibold text-white"
            >
              Descartar gravação?
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              A gravação não foi salva. Se sair agora, ela será perdida
              permanentemente.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onCancel();
                }}
                className="flex-1 rounded-[16px] border border-[#FF5D73]/40 bg-[#FF5D73]/10 px-4 py-3 text-sm font-semibold text-rose-100 transition duration-200 hover:bg-[#FF5D73]/16"
              >
                Descartar
              </button>
              <button
                onClick={() => setShowDiscardConfirm(false)}
                autoFocus
                className="flex-1 rounded-[16px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-white/[0.10]"
              >
                Continuar editando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewPlayer;
