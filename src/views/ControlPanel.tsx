import { useState, useEffect, useRef } from 'react';
import { Video, Settings, Circle, MousePointer2, Type, Monitor } from 'lucide-react';

const ControlPanel = () => {
    const [sources, setSources] = useState<{ id: string; name: string; thumbnail: string }[]>([]);
    const [selectedSourceId, setSelectedSourceId] = useState<string>('');
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        const getSources = async () => {
            if (window.electronAPI) {
                const sources = await window.electronAPI.getSources();
                setSources(sources);
                if (sources.length > 0) {
                    setSelectedSourceId(sources[0].id);
                }
            }
        };
        getSources();
    }, []);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: selectedSourceId,
                    },
                } as any,
            });

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                chunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm; codecs=vp9' });

                if (window.electronAPI) {
                    const buffer = await blob.arrayBuffer();
                    await window.electronAPI.saveRecording(buffer);
                } else {
                    // Fallback for browser testing
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `recording-${Date.now()}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (e) {
            console.error('Failed to start recording:', e);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8 font-sans">
            <header className="flex items-center gap-3 mb-10">
                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
                    <Video className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    Studio Recorder
                </h1>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recording Section */}
                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 p-8 rounded-3xl shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <Monitor className="w-5 h-5 text-blue-400" />
                        <h2 className="text-xl font-semibold">Recording Source</h2>
                    </div>

                    <div className="space-y-6">
                        <div className="relative group">
                            <select
                                className="w-full bg-gray-900/80 border border-gray-700 rounded-xl p-4 text-white appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none hover:bg-gray-900"
                                value={selectedSourceId}
                                onChange={(e) => setSelectedSourceId(e.target.value)}
                            >
                                {sources.map((source) => (
                                    <option key={source.id} value={source.id}>{source.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <MousePointer2 className="w-4 h-4" />
                            </div>
                        </div>

                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={!selectedSourceId}
                            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 ${isRecording
                                ? 'bg-gradient-to-r from-red-500 to-pink-600 shadow-red-500/25'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/25'
                                } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                        >
                            {isRecording ? (
                                <>
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                    </span>
                                    Stop Recording
                                </>
                            ) : (
                                <>
                                    <Video className="w-5 h-5" />
                                    Start Recording
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Settings Section */}
                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 p-8 rounded-3xl shadow-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <Settings className="w-5 h-5 text-purple-400" />
                        <h2 className="text-xl font-semibold">Studio Settings</h2>
                    </div>

                    <div className="space-y-8">
                        {/* Camera Shape */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                <Circle className="w-4 h-4" /> Camera Shape
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {['circle', 'square', 'rounded'].map((shape) => (
                                    <button
                                        key={shape}
                                        onClick={() => window.electronAPI?.setCameraShape(shape)}
                                        className="p-3 bg-gray-900/80 border border-gray-700 rounded-xl hover:bg-gray-700 hover:border-gray-600 transition-all text-sm capitalize"
                                    >
                                        {shape}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Camera Size */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                <Settings className="w-4 h-4" /> Camera Size
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {['small', 'medium', 'large'].map((size) => (
                                    <button
                                        key={size}
                                        onClick={() => window.electronAPI?.setCameraSize(size)}
                                        className="p-3 bg-gray-900/80 border border-gray-700 rounded-xl hover:bg-gray-700 hover:border-gray-600 transition-all text-sm capitalize"
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Teleprompter */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                <Type className="w-4 h-4" /> Teleprompter Script
                            </label>
                            <textarea
                                className="w-full bg-gray-900/80 border border-gray-700 rounded-xl p-4 text-white h-40 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none resize-none"
                                placeholder="Enter your script here..."
                                onChange={(e) => {
                                    if (window.electronAPI) {
                                        window.electronAPI.setTeleprompterText(e.target.value);
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
