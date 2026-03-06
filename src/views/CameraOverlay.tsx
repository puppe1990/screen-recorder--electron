import { useEffect, useRef, useState } from 'react';
import type { CameraShape } from '../../electron/ipc-contract';

const CameraOverlay = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [shape, setShape] = useState<CameraShape>('circle');

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
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
            }
        };

        startCamera();

        // Cleanup function to stop camera stream
        return () => {
            if (videoElement?.srcObject) {
                const stream = videoElement.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (!window.electronAPI) return;
        const cleanup = window.electronAPI.onCameraShapeChange((newShape) => {
            setShape(newShape);
        });

        return cleanup;
    }, []);

    const getShapeClass = () => {
        switch (shape) {
            case 'square': return 'rounded-none';
            case 'rounded': return 'rounded-3xl';
            case 'circle':
            default: return 'rounded-full';
        }
    };

    return (
        <div className={`w-full h-full flex items-center justify-center overflow-hidden border-4 border-blue-500 bg-black drag-region ${getShapeClass()}`}>
            <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
            />
            <style>{`
        .drag-region {
          -webkit-app-region: drag;
        }
      `}</style>
        </div>
    );
};

export default CameraOverlay;
