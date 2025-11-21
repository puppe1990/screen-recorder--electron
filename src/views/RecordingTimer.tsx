import { useState, useEffect } from 'react';

const RecordingTimer = () => {
    const [seconds, setSeconds] = useState(0);

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

    return (
        <div className="h-screen w-screen bg-gradient-to-r from-red-600 to-red-700 flex items-center justify-center">
            <div className="flex items-center gap-3 px-6 py-3">
                <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </div>
                <span className="text-white font-bold text-2xl font-mono tracking-wider">
                    {formatTime(seconds)}
                </span>
            </div>
        </div>
    );
};

export default RecordingTimer;

