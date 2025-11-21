import { useRef, useEffect, useState } from 'react';
import { Play, Pause, Download, X, Video, Rewind, FastForward, Volume2, VolumeX, Gauge } from 'lucide-react';

type VideoFormat = 'webm-vp9' | 'webm-vp8' | 'mp4' | 'webm';

interface PreviewPlayerProps {
    videoBlob: Blob;
    onSave: (format: VideoFormat) => void;
    onCancel: () => void;
}

const PreviewPlayer = ({ videoBlob, onSave, onCancel }: PreviewPlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState<VideoFormat>('webm-vp9');
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [resolution, setResolution] = useState('');

    useEffect(() => {
        const url = URL.createObjectURL(videoBlob);
        setVideoUrl(url);
        setIsPlaying(false);
        setDuration(0);
        setCurrentTime(0);
        setPlaybackRate(1);
        setIsMuted(false);
        setVolume(0.8);
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.pause();
            videoRef.current.playbackRate = 1;
        }

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [videoBlob]);

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

    const formatTime = (seconds: number) => {
        if (!Number.isFinite(seconds)) return '00:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
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

    const handleSave = () => {
        if (videoRef.current) {
            videoRef.current.pause();
        }
        onSave(selectedFormat);
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleSeek = (value: number) => {
        if (!videoRef.current) return;
        const safeTime = Math.min(Math.max(value, 0), videoRef.current.duration || 0);
        videoRef.current.currentTime = safeTime;
        setCurrentTime(safeTime);
    };

    const handleLoadedMetadata = () => {
        if (!videoRef.current) return;
        setDuration(videoRef.current.duration);
        setResolution(`${videoRef.current.videoWidth} x ${videoRef.current.videoHeight}`);
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

    const progressPercent = duration ? Math.min((currentTime / duration) * 100, 100) : 0;
    const playbackRates = [0.75, 1, 1.25, 1.5, 2];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto p-6" style={{ scrollBehavior: 'smooth' }}>
            <div className="min-h-full flex items-center justify-center py-6">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700 max-w-5xl w-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/20 rounded-xl">
                                <Video className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Preview da Gravação</h2>
                                <p className="text-slate-400 text-sm">Revise o vídeo antes de salvar</p>
                            </div>
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                            title="Fechar"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>

                    {/* Video Player */}
                    <div className="p-6 space-y-6">
                        <div className="bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center shadow-inner shadow-black/40">
                            <video
                                ref={videoRef}
                                src={videoUrl}
                                className="w-full h-full object-contain"
                                onEnded={handleVideoEnd}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                            />
                        </div>

                        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md shadow-black/20">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-slate-300 w-12 text-right">{formatTime(currentTime)}</span>
                                <div className="flex-1 relative">
                                    <input
                                        type="range"
                                        min={0}
                                        max={duration || 0}
                                        value={duration ? currentTime : 0}
                                        step="0.1"
                                        onChange={(e) => handleSeek(Number(e.target.value))}
                                        className="w-full accent-blue-500"
                                    />
                                    <div
                                        className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{
                                            background: 'linear-gradient(90deg, rgba(59,130,246,0.35) 0%, rgba(59,130,246,0.2) 100%)',
                                            width: `${progressPercent}%`,
                                            height: '4px',
                                            borderRadius: '9999px',
                                        }}
                                    />
                                </div>
                                <span className="text-xs font-mono text-slate-400 w-12">{formatTime(duration || 0)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md shadow-black/20">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-slate-200 font-semibold">
                                        <Play className="w-4 h-4" />
                                        Controles
                                    </div>
                                    <span className="text-xs text-slate-500">Navegue pelo preview</span>
                                </div>
                                <div className="flex items-center justify-center gap-3">
                                    <button
                                        onClick={() => handleSkip(-10)}
                                        className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-200 flex items-center gap-2"
                                        title="Voltar 10s"
                                    >
                                        <Rewind className="w-5 h-5" />
                                        <span className="text-sm font-semibold">10s</span>
                                    </button>
                                    <button
                                        onClick={handlePlayPause}
                                        className={`px-4 py-3 rounded-xl transition-colors flex items-center gap-2 font-semibold ${
                                            isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                    >
                                        {isPlaying ? (
                                            <>
                                                <Pause className="w-5 h-5 text-white" />
                                                <span className="text-white">Pausar</span>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-5 h-5 text-white" />
                                                <span className="text-white">Reproduzir</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleSkip(10)}
                                        className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-200 flex items-center gap-2"
                                        title="Avançar 10s"
                                    >
                                        <span className="text-sm font-semibold">10s</span>
                                        <FastForward className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md shadow-black/20">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-slate-200 font-semibold">
                                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                        Áudio
                                    </div>
                                    <span className="text-xs text-slate-500">Ajuste volume</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleToggleMute}
                                        className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-200"
                                        title={isMuted ? 'Reativar áudio' : 'Silenciar áudio'}
                                    >
                                        {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                    </button>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={isMuted ? 0 : volume}
                                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                                        className="flex-1 accent-blue-500"
                                    />
                                    <span className="text-xs font-mono text-slate-300 w-10 text-right">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                                </div>
                            </div>

                            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md shadow-black/20">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-slate-200 font-semibold">
                                        <Gauge className="w-4 h-4" />
                                        Velocidade e Infos
                                    </div>
                                    <span className="text-xs text-slate-500">Refine o preview</span>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {playbackRates.map((rate) => (
                                        <button
                                            key={rate}
                                            onClick={() => handleRateChange(rate)}
                                            className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                                playbackRate === rate
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                            }`}
                                        >
                                            {rate}x
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                                    <div className="bg-slate-800/60 rounded-lg p-3">
                                        <p className="text-slate-400">Duração</p>
                                        <p className="font-semibold text-white">{duration ? formatTime(duration) : 'Carregando...'}</p>
                                    </div>
                                    <div className="bg-slate-800/60 rounded-lg p-3">
                                        <p className="text-slate-400">Resolução</p>
                                        <p className="font-semibold text-white">{resolution || 'Detectando...'}</p>
                                    </div>
                                    <div className="bg-slate-800/60 rounded-lg p-3">
                                        <p className="text-slate-400">Tamanho</p>
                                        <p className="font-semibold text-white">{sizeLabel()}</p>
                                    </div>
                                    <div className="bg-slate-800/60 rounded-lg p-3">
                                        <p className="text-slate-400">Formato original</p>
                                        <p className="font-semibold text-white">{videoBlob.type || 'WebM'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Format Selection */}
                        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 shadow-md shadow-black/20">
                            <label className="block text-sm font-semibold text-slate-300 mb-3">
                                Formato de Vídeo para Salvar
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {(['webm-vp9', 'webm-vp8', 'mp4'] as VideoFormat[]).map((format) => (
                                    <button
                                        key={format}
                                        onClick={() => setSelectedFormat(format)}
                                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                                            selectedFormat === format
                                                ? 'border-blue-500 bg-blue-500/10 text-blue-300 shadow-blue-500/10'
                                                : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 text-slate-300'
                                        }`}
                                    >
                                        <div className="font-semibold mb-1">
                                            {format === 'webm-vp9' && 'WebM (VP9)'}
                                            {format === 'webm-vp8' && 'WebM (VP8)'}
                                            {format === 'mp4' && 'MP4 (H.264)'}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {format === 'webm-vp9' && 'Melhor qualidade'}
                                            {format === 'webm-vp8' && 'Boa compatibilidade'}
                                            {format === 'mp4' && 'Formato universal'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={onCancel}
                                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors text-white font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-colors text-white font-semibold flex items-center gap-2"
                            >
                                <Download className="w-5 h-5" />
                                Salvar Vídeo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreviewPlayer;
