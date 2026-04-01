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
        return 'rounded-3xl';
      case 'circle':
      default:
        return 'rounded-full';
    }
  };

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-transparent drag-region ring-2 ring-cyan-400/60 shadow-[0_0_24px_rgba(110,231,249,0.45)] ${getShapeClass()}`}
    >
      {isLoading && !visibleMessage && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        </div>
      )}
      {visibleMessage ? (
        <div className="flex h-full w-full flex-col items-start justify-end bg-[linear-gradient(180deg,rgba(0,0,0,0.25),rgba(0,0,0,0.72))] p-5 gap-3">
          <div className="max-w-[78%] rounded-[20px] border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Camera status
            </p>
            <p className="mt-2 text-sm font-medium text-slate-100">
              {visibleMessage}
            </p>
          </div>
          {errorMessage && (
            <button
              onClick={() => void startCamera()}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="rounded-[16px] border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition duration-200 hover:bg-white/20"
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
            className="block h-full w-full object-cover transform scale-x-[-1]"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.00),rgba(0,0,0,0.08)_65%,rgba(0,0,0,0.26))]" />
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
