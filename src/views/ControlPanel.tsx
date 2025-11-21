import { useState, useEffect, useRef } from 'react';
import { Video, Settings, Circle, MousePointer2, Type, Monitor } from 'lucide-react';

const ControlPanel = () => {
    const [sources, setSources] = useState<{ id: string; name: string; thumbnail: string }[]>([]);
    const [selectedSourceId, setSelectedSourceId] = useState<string>('');
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        console.log('ControlPanel mounted');
        console.log('window.electronAPI available:', !!window.electronAPI);
        
        const getSources = async () => {
            if (window.electronAPI) {
                try {
                    const sources = await window.electronAPI.getSources();
                    console.log('Sources received:', sources);
                    setSources(sources);
                    if (sources.length > 0) {
                        setSelectedSourceId(sources[0].id);
                    }
                } catch (error) {
                    console.error('Error getting sources:', error);
                }
            } else {
                console.warn('electronAPI not available - running in browser mode?');
            }
        };
        getSources();
    }, []);

    const startRecording = async () => {
        try {
            if (!selectedSourceId) {
                console.error('No source selected');
                return;
            }

            // Get screen capture stream
            const screenStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    // @ts-ignore - Electron-specific constraints
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: selectedSourceId,
                        minWidth: 1280,
                        maxWidth: 1920,
                        minHeight: 720,
                        maxHeight: 1080
                    }
                } as any,
            });

            // Get camera stream
            let cameraStream: MediaStream | null = null;
            try {
                cameraStream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        width: 300, 
                        height: 300,
                        facingMode: 'user'
                    },
                    audio: false,
                });
            } catch (cameraError) {
                console.warn('Could not access camera, recording without camera overlay:', cameraError);
            }

            // Combine streams using Canvas API
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                throw new Error('Could not get canvas context');
            }

            // Set canvas size to match screen stream
            const screenVideo = document.createElement('video');
            screenVideo.srcObject = screenStream;
            screenVideo.autoplay = true;
            screenVideo.muted = true;
            await new Promise((resolve) => {
                screenVideo.onloadedmetadata = () => {
                    canvas.width = screenVideo.videoWidth;
                    canvas.height = screenVideo.videoHeight;
                    resolve(null);
                };
            });

            let cameraVideo: HTMLVideoElement | null = null;
            if (cameraStream) {
                cameraVideo = document.createElement('video');
                cameraVideo.srcObject = cameraStream;
                cameraVideo.autoplay = true;
                cameraVideo.muted = true;
                await new Promise((resolve) => {
                    cameraVideo!.onloadedmetadata = () => resolve(null);
                });
            }

            // Draw function to combine streams
            const draw = () => {
                if (!ctx) return;
                
                // Draw screen
                ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
                
                // Draw camera overlay in bottom right corner
                if (cameraVideo) {
                    const cameraSize = 300;
                    const x = canvas.width - cameraSize - 20;
                    const y = canvas.height - cameraSize - 20;
                    
                    // Draw circular mask for camera
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(x + cameraSize / 2, y + cameraSize / 2, cameraSize / 2, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(cameraVideo, x, y, cameraSize, cameraSize);
                    ctx.restore();
                    
                    // Draw border
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(x + cameraSize / 2, y + cameraSize / 2, cameraSize / 2, 0, Math.PI * 2);
                    ctx.stroke();
                }
                
                requestAnimationFrame(draw);
            };
            
            draw();

            // Get stream from canvas
            const combinedStream = canvas.captureStream(30); // 30 FPS

            const mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 2500000
            });
            
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: 'video/webm;codecs=vp9' });

                // Stop all tracks to release resources
                screenStream.getTracks().forEach(track => track.stop());
                if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                }
                screenVideo.srcObject = null;
                if (cameraVideo) {
                    cameraVideo.srcObject = null;
                }

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

            mediaRecorder.onerror = (e) => {
                console.error('MediaRecorder error:', e);
                setIsRecording(false);
            };

            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
        } catch (e) {
            console.error('Failed to start recording:', e);
            alert(`Erro ao iniciar gravação: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-8 font-sans" style={{ pointerEvents: 'auto' }}>
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
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('Recording button clicked, isRecording:', isRecording);
                                if (isRecording) {
                                    stopRecording();
                                } else {
                                    startRecording();
                                }
                            }}
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
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('Setting camera shape to:', shape);
                                            if (window.electronAPI) {
                                                window.electronAPI.setCameraShape(shape);
                                            } else {
                                                console.error('electronAPI not available');
                                            }
                                        }}
                                        className="p-3 bg-gray-900/80 border border-gray-700 rounded-xl hover:bg-gray-700 hover:border-gray-600 transition-all text-sm capitalize cursor-pointer"
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
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            console.log('Setting camera size to:', size);
                                            if (window.electronAPI) {
                                                window.electronAPI.setCameraSize(size);
                                            } else {
                                                console.error('electronAPI not available');
                                            }
                                        }}
                                        className="p-3 bg-gray-900/80 border border-gray-700 rounded-xl hover:bg-gray-700 hover:border-gray-600 transition-all text-sm capitalize cursor-pointer"
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Teleprompter */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                                    <Type className="w-4 h-4" /> Teleprompter Script
                                </label>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Open teleprompter button clicked');
                                        if (window.electronAPI) {
                                            window.electronAPI.openTeleprompter();
                                        } else {
                                            console.error('electronAPI not available');
                                        }
                                    }}
                                    className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded-lg transition-colors cursor-pointer"
                                >
                                    Abrir Teleprompter
                                </button>
                            </div>
                            <textarea
                                className="w-full bg-gray-900/80 border border-gray-700 rounded-xl p-4 text-white h-40 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none resize-none font-mono text-sm"
                                placeholder="Digite seu script aqui... O texto aparecerá no teleprompter em tempo real."
                                defaultValue=""
                                onInput={(e) => {
                                    const text = (e.target as HTMLTextAreaElement).value;
                                    console.log('Setting teleprompter text (length):', text.length);
                                    if (window.electronAPI) {
                                        window.electronAPI.setTeleprompterText(text);
                                    } else {
                                        console.error('electronAPI not available');
                                    }
                                }}
                                onChange={(e) => {
                                    const text = e.target.value;
                                    console.log('Setting teleprompter text (onChange):', text.length);
                                    if (window.electronAPI) {
                                        window.electronAPI.setTeleprompterText(text);
                                    } else {
                                        console.error('electronAPI not available');
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
