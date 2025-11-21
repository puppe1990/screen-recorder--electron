import { useState, useEffect } from 'react';
import { Square, Circle, Video, Eye, EyeOff } from 'lucide-react';

const RecordingTimer = () => {
    const [seconds, setSeconds] = useState(0);
    const [cameraShape, setCameraShape] = useState<string>('circle');
    const [cameraSize, setCameraSize] = useState<string>('medium');
    const [cameraVisible, setCameraVisible] = useState<boolean>(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setSeconds(s => s + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStopRecording = () => {
        // This will trigger the stop in the main control panel
        if (window.electronAPI) {
            window.electronAPI.stopRecording();
        }
    };

    const handleCameraShape = (shape: string) => {
        setCameraShape(shape);
        if (window.electronAPI) {
            window.electronAPI.setCameraShape(shape);
        }
    };

    const handleCameraSize = (size: string) => {
        setCameraSize(size);
        if (window.electronAPI) {
            window.electronAPI.setCameraSize(size);
        }
    };

    const handleCameraVisibility = () => {
        const newVisibility = !cameraVisible;
        setCameraVisible(newVisibility);
        if (window.electronAPI) {
            if (newVisibility) {
                window.electronAPI.showCameraWindow();
            } else {
                window.electronAPI.hideCameraWindow();
            }
        }
    };

    return (
        <div className="h-screen w-screen bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-center border-2 border-slate-700 rounded-xl shadow-2xl">
            <div className="flex items-center gap-4 px-4 py-2">
                {/* Timer Display */}
                <div className="flex items-center gap-2 border-r border-slate-600 pr-4">
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </div>
                    <span className="text-white font-bold text-xl font-mono tracking-wider">
                        {formatTime(seconds)}
                    </span>
                </div>

                {/* Quick Controls */}
                <div className="flex items-center gap-2">
                    {/* Camera Shape */}
                    <button
                        onClick={() => handleCameraShape(cameraShape === 'circle' ? 'square' : cameraShape === 'square' ? 'rounded' : 'circle')}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                        title="Formato da Câmera"
                    >
                        <Circle className={`w-4 h-4 ${cameraShape === 'circle' ? 'text-blue-400' : 'text-slate-300'}`} />
                    </button>

                    {/* Camera Size */}
                    <button
                        onClick={() => handleCameraSize(cameraSize === 'small' ? 'medium' : cameraSize === 'medium' ? 'large' : 'small')}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                        title="Tamanho da Câmera"
                    >
                        <Video className="w-4 h-4 text-slate-300" />
                    </button>

                    {/* Camera Visibility */}
                    <button
                        onClick={handleCameraVisibility}
                        className={`p-2 rounded-lg transition-colors ${cameraVisible ? 'bg-green-600 hover:bg-green-500' : 'bg-slate-700 hover:bg-slate-600'}`}
                        title={cameraVisible ? 'Ocultar Câmera' : 'Mostrar Câmera'}
                    >
                        {cameraVisible ? <Eye className="w-4 h-4 text-white" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                    </button>

                    {/* Stop Recording */}
                    <button
                        onClick={handleStopRecording}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors ml-2"
                        title="Parar Gravação"
                    >
                        <Square className="w-4 h-4 text-white fill-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecordingTimer;

