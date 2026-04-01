import { useState, useEffect } from 'react';
import { Square, Circle, Eye, EyeOff, GripVertical } from 'lucide-react';
import type { CameraShape, CameraSize } from '../../electron/ipc-contract';

const RecordingTimer = () => {
  const [seconds, setSeconds] = useState(0);
  const [cameraShape, setCameraShape] = useState<CameraShape>('circle');
  const [cameraSize, setCameraSize] = useState<CameraSize>('medium');
  const [cameraVisible, setCameraVisible] = useState<boolean>(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
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

  const handleCameraShape = (shape: CameraShape) => {
    setCameraShape(shape);
    if (window.electronAPI) {
      window.electronAPI.setCameraShape(shape);
    }
  };

  const handleCameraSize = (size: CameraSize) => {
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
    <div
      className="flex h-screen w-screen items-center justify-center overflow-hidden px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-3 rounded-[24px] border border-white/8 bg-[rgba(10,12,16,0.82)] px-4 py-3 shadow-[0_22px_60px_rgba(0,0,0,0.46)] backdrop-blur-[18px]">
        <div className="flex items-center text-slate-500 cursor-move">
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex items-center gap-2 border-r border-white/8 pr-4">
          <div className="relative flex h-3 w-3">
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#FF5D73] shadow-[0_0_14px_rgba(255,93,115,0.95)]"></span>
          </div>
          <span className="font-mono whitespace-nowrap text-xl font-semibold tracking-[0.08em] text-white">
            {formatTime(seconds)}
          </span>
        </div>

        <div
          className="flex items-center gap-2 border-r border-white/8 pr-4"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <span className="mr-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Forma
          </span>
          <button
            onClick={() => handleCameraShape('circle')}
            className={`rounded-[16px] border px-3 py-2 transition duration-200 ${cameraShape === 'circle' ? 'border-cyan-300/25 bg-cyan-300/14 text-cyan-50' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}
            title="Círculo"
          >
            <Circle className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => handleCameraShape('rounded')}
            className={`rounded-[16px] border px-3 py-2 transition duration-200 ${cameraShape === 'rounded' ? 'border-cyan-300/25 bg-cyan-300/14 text-cyan-50' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}
            title="Arredondado"
          >
            <div className="w-4 h-4 border-2 border-white rounded-md"></div>
          </button>
          <button
            onClick={() => handleCameraShape('square')}
            className={`rounded-[16px] border px-3 py-2 transition duration-200 ${cameraShape === 'square' ? 'border-cyan-300/25 bg-cyan-300/14 text-cyan-50' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}
            title="Quadrado"
          >
            <Square className="w-4 h-4 text-white" />
          </button>
        </div>

        <div
          className="flex items-center gap-2 border-r border-white/8 pr-4"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <span className="mr-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Escala
          </span>
          <button
            onClick={() => handleCameraSize('small')}
            className={`rounded-[16px] border px-3 py-2 text-xs font-semibold transition duration-200 ${cameraSize === 'small' ? 'border-cyan-300/25 bg-cyan-300/14 text-cyan-50' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}
            title="Pequeno"
          >
            Compacto
          </button>
          <button
            onClick={() => handleCameraSize('medium')}
            className={`rounded-[16px] border px-3 py-2 text-xs font-semibold transition duration-200 ${cameraSize === 'medium' ? 'border-cyan-300/25 bg-cyan-300/14 text-cyan-50' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}
            title="Médio"
          >
            Médio
          </button>
          <button
            onClick={() => handleCameraSize('large')}
            className={`rounded-[16px] border px-3 py-2 text-xs font-semibold transition duration-200 ${cameraSize === 'large' ? 'border-cyan-300/25 bg-cyan-300/14 text-cyan-50' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}
            title="Grande"
          >
            Palco
          </button>
        </div>

        <div
          className="flex items-center gap-2 border-r border-white/8 pr-4"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleCameraVisibility}
            className={`rounded-[16px] border p-2.5 transition duration-200 ${cameraVisible ? 'border-emerald-300/25 bg-emerald-300/12 text-emerald-50 hover:bg-emerald-300/18' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}`}
            title={cameraVisible ? 'Ocultar Câmera' : 'Mostrar Câmera'}
          >
            {cameraVisible ? (
              <Eye className="w-4 h-4 text-white" />
            ) : (
              <EyeOff className="w-4 h-4 text-slate-300" />
            )}
          </button>
        </div>

        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={handleStopRecording}
            className="flex items-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#FF5D73,#D92D4A)] px-4 py-2.5 font-semibold text-white shadow-[0_18px_38px_rgba(255,93,115,0.26)] transition duration-200 hover:brightness-105"
            title="Parar Gravação"
          >
            <Square className="w-4 h-4 text-white fill-white" />
            <span className="text-white font-semibold text-sm whitespace-nowrap">
              Parar
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingTimer;
