import { useEffect, useRef, useState } from 'react';
import type { CameraShape } from '../../electron/ipc-contract';

const CameraOverlay = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shape, setShape] = useState<CameraShape>('circle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  useEffect(() => {
    const videoElement = videoRef.current;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 300, height: 300 },
          audio: false,
        });
        if (videoElement) {
          videoElement.srcObject = stream;
          await videoElement.play().catch(() => undefined);
        }
        setErrorMessage(null);
      } catch (err) {
        setErrorMessage(resolveCameraError(err));
      }
    };

    startCamera();

    // Cleanup function to stop camera stream
    return () => {
      if (videoElement?.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
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
      className={`w-full h-full flex items-center justify-center overflow-hidden border-4 border-blue-500 bg-black drag-region ${getShapeClass()}`}
    >
      {visibleMessage ? (
        <div className="flex h-full w-full items-center justify-center bg-slate-950/95 px-6 text-center text-sm text-rose-200">
          {visibleMessage}
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover transform scale-x-[-1]"
        />
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
