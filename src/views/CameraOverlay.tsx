import { useEffect, useRef, useState } from 'react';

const CameraOverlay = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [shape, setShape] = useState('circle');

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 300, height: 300 },
                    audio: false,
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
            }
        };

        startCamera();

        if (window.electronAPI) {
            window.electronAPI.onCameraShapeChange((newShape) => {
                setShape(newShape);
            });
        }
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
