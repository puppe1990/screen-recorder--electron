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

        // Cleanup function to stop camera stream
        return () => {
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    useEffect(() => {
        if (window.electronAPI) {
            const handleShapeChange = (newShape: string) => {
                setShape(newShape);
            };
            
            // Register listener
            window.electronAPI.onCameraShapeChange(handleShapeChange);
            
            // Note: In Electron with contextBridge, listeners are automatically cleaned up
            // but we can't manually remove them. The listener will persist for the window lifetime.
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
