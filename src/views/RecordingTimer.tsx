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

  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <div
      className="flex h-screen w-screen items-center justify-center overflow-hidden px-3"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="panel-frame flex items-center gap-2.5 px-3 py-2.5">
        <GripVertical className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />

        <div className="flex items-center gap-2 border-r border-[var(--border-subtle)] pr-3">
          <span className="status-dot status-dot-recording" />
          <span className="font-mono whitespace-nowrap text-lg font-semibold tabular-nums">
            {formatTime(seconds)}
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 border-r border-[var(--border-subtle)] pr-3"
          style={noDrag}
        >
          <span className="label-caps mr-0.5">Forma</span>
          {(['circle', 'rounded', 'square'] as CameraShape[]).map((shape) => (
            <button
              key={shape}
              onClick={() => handleCameraShape(shape)}
              className={`btn-segment px-2.5 py-2 ${cameraShape === shape ? 'btn-segment-active' : ''}`}
              title={shape}
            >
              {shape === 'circle' && <Circle className="h-3.5 w-3.5" />}
              {shape === 'rounded' && (
                <div className="h-3.5 w-3.5 rounded border-2 border-current" />
              )}
              {shape === 'square' && <Square className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>

        <div
          className="flex items-center gap-1.5 border-r border-[var(--border-subtle)] pr-3"
          style={noDrag}
        >
          <span className="label-caps mr-0.5">Escala</span>
          {(['small', 'medium', 'large'] as CameraSize[]).map((size) => (
            <button
              key={size}
              onClick={() => handleCameraSize(size)}
              className={`btn-segment px-2 py-2 text-xs ${cameraSize === size ? 'btn-segment-active' : ''}`}
            >
              {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
            </button>
          ))}
        </div>

        <div
          className="border-r border-[var(--border-subtle)] pr-3"
          style={noDrag}
        >
          <button
            onClick={handleCameraVisibility}
            className={`btn p-2 ${cameraVisible ? 'border-[var(--success-muted)] bg-[var(--success-muted)] text-green-100' : 'btn-ghost'}`}
            title={cameraVisible ? 'Ocultar câmera' : 'Mostrar câmera'}
          >
            {cameraVisible ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <div style={noDrag}>
          <button
            onClick={handleStopRecording}
            className="btn-stop px-3 py-2 text-sm"
            title="Parar gravação"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Parar
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingTimer;
