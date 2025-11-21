import { useRef, useEffect, useState } from 'react';
import { Play, Pause, Download, X, Video } from 'lucide-react';

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

    useEffect(() => {
        const url = URL.createObjectURL(videoBlob);
        setVideoUrl(url);

        return () => {
            URL.revokeObjectURL(url);
        };
    }, [videoBlob]);

    const handlePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleVideoEnd = () => {
        setIsPlaying(false);
    };

    const handleSave = () => {
        onSave(selectedFormat);
    };

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
                    <div className="p-6">
                        <div className="bg-black rounded-xl overflow-hidden mb-6 aspect-video flex items-center justify-center">
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            className="w-full h-full object-contain"
                            onEnded={handleVideoEnd}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                        />
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-center gap-4 mb-6">
                        <button
                            onClick={handlePlayPause}
                            className="p-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-2"
                        >
                            {isPlaying ? (
                                <>
                                    <Pause className="w-5 h-5 text-white" />
                                    <span className="text-white font-semibold">Pausar</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5 text-white" />
                                    <span className="text-white font-semibold">Reproduzir</span>
                                </>
                            )}
                        </button>
                        </div>

                        {/* Format Selection */}
                        <div className="mb-6">
                        <label className="block text-sm font-semibold text-slate-300 mb-3">
                            Formato de Vídeo para Salvar
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['webm-vp9', 'webm-vp8', 'mp4'] as VideoFormat[]).map((format) => (
                                <button
                                    key={format}
                                    onClick={() => setSelectedFormat(format)}
                                    className={`p-4 rounded-xl border-2 transition-all ${
                                        selectedFormat === format
                                            ? 'border-blue-500 bg-blue-500/10 text-blue-300'
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

