import { useEffect, useRef, useState } from 'react';
import type { CameraShape } from '../../electron/ipc-contract';

const CameraOverlay = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shape, setShape] = useState<CameraShape>('circle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolveCameraError = (err: unknown) => {
    if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          return 'Permita acesso à câmera nas configurações do macOS e reabra o app.';
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          return 'Nenhuma câmera foi encontrada neste Mac.';
        case 'NotReadableError':
        case 'TrackStartError':
          return 'A câmera está em uso por outro app ou indisponível no momento.';
        default:
          return err.message || 'Não foi possível abrir a câmera.';
      }
    }

    return err instanceof Error
      ? err.message
      : 'Não foi possível abrir a câmera.';
  };

  const startCamera = async () => {
    const videoElement = videoRef.current;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 300, height: 300 },
        audio: false,
      });
      if (videoElement) {
        videoElement.srcObject = stream;
        await videoElement.play().catch(() => undefined);
      }
    } catch (err) {
      setErrorMessage(resolveCameraError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    void startCamera();

    return () => {
      if (videoElement?.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanup = window.electronAPI.onCameraShapeChange((newShape) => {
      setShape(newShape);
    });
    const cleanupStatus = window.electronAPI.onCameraStatusChange((message) => {
      setStatusMessage(message);
    });

    return () => {
      cleanup();
      cleanupStatus();
    };
  }, []);

  const visibleMessage = errorMessage ?? statusMessage;

  const getShapeClass = () => {
    switch (shape) {
      case 'square':
        return 'rounded-none';
      case 'rounded':
        return 'rounded-2xl';
      case 'circle':
      default:
        return 'rounded-full';
    }
  };

  return (
    <div
      className={`drag-region relative flex h-full w-full items-center justify-center overflow-hidden bg-transparent ring-2 ring-[var(--border-strong)] shadow-panel ${getShapeClass()}`}
    >
      {isLoading && !visibleMessage && (
        <div className="flex h-full w-full items-center justify-center bg-[var(--bg-overlay)]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--text-primary)]" />
        </div>
      )}
      {visibleMessage ? (
        <div className="flex h-full w-full flex-col items-start justify-end gap-2.5 bg-gradient-to-t from-black/80 to-black/20 p-4">
          <div className="max-w-[85%] rounded-control border border-[var(--border-default)] bg-black/50 px-3.5 py-2.5 backdrop-blur-md">
            <p className="label-caps">Câmera</p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">
              {visibleMessage}
            </p>
          </div>
          {errorMessage && (
            <button
              onClick={() => void startCamera()}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              Tentar novamente
            </button>
          )}
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Feed da câmera (imagem espelhada)"
            className="block h-full w-full scale-x-[-1] transform object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        </>
      )}
      <style>{`
        .drag-region {
          -webkit-app-region: drag;
        }
      `}</style>
    </div>
  );
};

export default CameraOverlay;
