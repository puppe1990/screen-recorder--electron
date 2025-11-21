import { useState, useEffect, useRef } from 'react';
import { Video, Settings, Circle, MousePointer2, Type, Monitor } from 'lucide-react';

type VideoFormat = 'webm-vp9' | 'webm-vp8' | 'mp4' | 'webm';

const ControlPanel = () => {
    const [sources, setSources] = useState<{ id: string; name: string; thumbnail: string }[]>([]);
    const [selectedSourceId, setSelectedSourceId] = useState<string>('');
    const [isRecording, setIsRecording] = useState(false);
    const [cameraShape, setCameraShape] = useState<string>('circle');
    const [videoFormat, setVideoFormat] = useState<VideoFormat>('webm-vp9');
    const [cameraVisible, setCameraVisible] = useState<boolean>(true);
    const cameraShapeRef = useRef<string>('circle');
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

    // Listen for camera shape changes
    useEffect(() => {
        if (window.electronAPI) {
            const handleShapeChange = (newShape: string) => {
                console.log('Camera shape changed to:', newShape);
                setCameraShape(newShape);
                cameraShapeRef.current = newShape; // Update ref for recording
            };
            
            window.electronAPI.onCameraShapeChange(handleShapeChange);
        }
    }, []);

    const startRecording = async () => {
        try {
            if (!selectedSourceId) {
                console.error('No source selected');
                return;
            }

            // Get screen capture stream
            // The camera window is already visible on screen and will be captured automatically
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

            // Hide control window before recording
            if (window.electronAPI) {
                window.electronAPI.hideControlWindow();
            }

            // Get MIME type and codec based on selected format
            let mimeType = 'video/webm;codecs=vp9';
            
            switch (videoFormat) {
                case 'webm-vp9':
                    mimeType = 'video/webm;codecs=vp9';
                    break;
                case 'webm-vp8':
                    mimeType = 'video/webm;codecs=vp8';
                    break;
                case 'mp4':
                    // Try H.264, fallback to VP9 if not supported
                    if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264')) {
                        mimeType = 'video/mp4;codecs=h264';
                    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
                        mimeType = 'video/webm;codecs=h264';
                    } else {
                        // Fallback to VP9
                        mimeType = 'video/webm;codecs=vp9';
                    }
                    break;
                default:
                    mimeType = 'video/webm;codecs=vp9';
            }

            // Check if the MIME type is supported, fallback to VP9 if not
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                console.warn(`MIME type ${mimeType} not supported, falling back to VP9`);
                mimeType = 'video/webm;codecs=vp9';
            }

            // Record directly from screen stream (camera window is already visible on screen)
            const mediaRecorder = new MediaRecorder(screenStream, {
                mimeType: mimeType,
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
                // Determine blob type and extension based on format
                let finalBlobType = 'video/webm';
                let finalExtension = 'webm';
                
                switch (videoFormat) {
                    case 'webm-vp9':
                    case 'webm-vp8':
                        finalBlobType = 'video/webm';
                        finalExtension = 'webm';
                        break;
                    case 'mp4':
                        finalBlobType = 'video/mp4';
                        finalExtension = 'mp4';
                        break;
                    default:
                        finalBlobType = 'video/webm';
                        finalExtension = 'webm';
                }

                const blob = new Blob(chunksRef.current, { type: finalBlobType });

                // Stop all tracks to release resources
                screenStream.getTracks().forEach(track => track.stop());

                // Show control window after recording stops
                if (window.electronAPI) {
                    window.electronAPI.showControlWindow();
                }

                if (window.electronAPI) {
                    const buffer = await blob.arrayBuffer();
                    await window.electronAPI.saveRecording(buffer, finalExtension);
                } else {
                    // Fallback for browser testing
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `recording-${Date.now()}.${finalExtension}`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                }
            };

            mediaRecorder.onerror = (e) => {
                console.error('MediaRecorder error:', e);
                setIsRecording(false);
                // Show control window on error
                if (window.electronAPI) {
                    window.electronAPI.showControlWindow();
                }
            };

            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
        } catch (e) {
            console.error('Failed to start recording:', e);
            alert(`Erro ao iniciar gravação: ${e instanceof Error ? e.message : 'Erro desconhecido'}`);
            setIsRecording(false);
            // Show control window on error
            if (window.electronAPI) {
                window.electronAPI.showControlWindow();
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // Show control window after stopping
            if (window.electronAPI) {
                window.electronAPI.showControlWindow();
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white" style={{ pointerEvents: 'auto' }}>
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <header className="mb-12">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/30">
                            <Video className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-blue-300">
                                Studio Recorder
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">Grave sua tela com qualidade profissional</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Main Recording Section - Takes 2 columns */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Recording Card */}
                        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2.5 bg-blue-500/20 rounded-xl">
                                    <Monitor className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Gravação</h2>
                                    <p className="text-slate-400 text-sm">Selecione a fonte e inicie a gravação</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Source Selection */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-3">
                                        Fonte de Gravação
                                    </label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-slate-900/80 border-2 border-slate-700 rounded-xl p-4 pr-12 text-white text-base appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none hover:border-slate-600 cursor-pointer"
                                            value={selectedSourceId}
                                            onChange={(e) => setSelectedSourceId(e.target.value)}
                                        >
                                            {sources.length === 0 ? (
                                                <option value="">Carregando fontes...</option>
                                            ) : (
                                                sources.map((source) => (
                                                    <option key={source.id} value={source.id} className="bg-slate-800">
                                                        {source.name}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <MousePointer2 className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>

                                {/* Video Format Selection */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-3">
                                        Formato de Vídeo
                                    </label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-slate-900/80 border-2 border-slate-700 rounded-xl p-4 pr-12 text-white text-base appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none hover:border-slate-600 cursor-pointer"
                                            value={videoFormat}
                                            onChange={(e) => setVideoFormat(e.target.value as VideoFormat)}
                                            disabled={isRecording}
                                        >
                                            <option value="webm-vp9" className="bg-slate-800">WebM (VP9) - Alta Qualidade</option>
                                            <option value="webm-vp8" className="bg-slate-800">WebM (VP8) - Compatível</option>
                                            <option value="mp4" className="bg-slate-800">MP4 (H.264) - Universal</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <Video className="w-5 h-5" />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        {videoFormat === 'webm-vp9' && 'Melhor qualidade, arquivo menor'}
                                        {videoFormat === 'webm-vp8' && 'Boa compatibilidade'}
                                        {videoFormat === 'mp4' && 'Formato mais compatível (pode converter para WebM)'}
                                    </p>
                                </div>

                                {/* Recording Button */}
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
                                    disabled={!selectedSourceId || sources.length === 0}
                                    className={`w-full py-5 rounded-xl font-bold text-lg shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 ${
                                        isRecording
                                            ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-red-500/40 text-white'
                                            : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-blue-500/40 text-white'
                                    } disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:hover:scale-100`}
                                >
                                    {isRecording ? (
                                        <>
                                            <span className="relative flex h-4 w-4">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-4 w-4 bg-white"></span>
                                            </span>
                                            <span>Parar Gravação</span>
                                        </>
                                    ) : (
                                        <>
                                            <Video className="w-6 h-6" />
                                            <span>Iniciar Gravação</span>
                                        </>
                                    )}
                                </button>

                                {isRecording && (
                                    <div className="flex items-center gap-2 text-red-400 text-sm">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
                                        </span>
                                        <span>Gravando em andamento...</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Teleprompter Section */}
                        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-purple-500/20 rounded-xl">
                                        <Type className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">Teleprompter</h2>
                                        <p className="text-slate-400 text-xs">Escreva seu script aqui</p>
                                    </div>
                                </div>
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
                                    className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/30 cursor-pointer"
                                >
                                    Abrir Janela
                                </button>
                            </div>
                            <textarea
                                className="w-full bg-slate-900/80 border-2 border-slate-700 rounded-xl p-4 text-white h-48 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none resize-none font-sans text-sm leading-relaxed placeholder:text-slate-500"
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

                    {/* Settings Sidebar */}
                    <div className="xl:col-span-1">
                        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-6 sticky top-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-purple-500/20 rounded-xl">
                                    <Settings className="w-5 h-5 text-purple-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white">Configurações</h2>
                            </div>

                            <div className="space-y-6">
                                {/* Camera Shape */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                        <Circle className="w-4 h-4" />
                                        Formato da Câmera
                                    </label>
                                    <div className="grid grid-cols-1 gap-2">
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
                                                className={`p-3.5 bg-slate-900/80 border-2 rounded-xl transition-all text-sm font-medium capitalize cursor-pointer text-left ${
                                                    cameraShape === shape
                                                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                                                        : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300'
                                                }`}
                                            >
                                                {shape === 'circle' ? 'Círculo' : shape === 'square' ? 'Quadrado' : 'Arredondado'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Camera Size */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                        <Settings className="w-4 h-4" />
                                        Tamanho da Câmera
                                    </label>
                                    <div className="grid grid-cols-1 gap-2">
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
                                                className="p-3.5 bg-slate-900/80 border-2 border-slate-700 rounded-xl hover:border-slate-600 hover:bg-slate-800 transition-all text-sm font-medium capitalize cursor-pointer text-left text-slate-300"
                                            >
                                                {size === 'small' ? 'Pequeno' : size === 'medium' ? 'Médio' : 'Grande'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Camera Visibility Toggle */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                        <Video className="w-4 h-4" />
                                        Visibilidade da Câmera
                                    </label>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const newVisibility = !cameraVisible;
                                            setCameraVisible(newVisibility);
                                            console.log('Setting camera visibility to:', newVisibility);
                                            if (window.electronAPI) {
                                                if (newVisibility) {
                                                    window.electronAPI.showCameraWindow();
                                                } else {
                                                    window.electronAPI.hideCameraWindow();
                                                }
                                            } else {
                                                console.error('electronAPI not available');
                                            }
                                        }}
                                        className={`w-full p-3.5 bg-slate-900/80 border-2 rounded-xl transition-all text-sm font-medium cursor-pointer text-left ${
                                            cameraVisible
                                                ? 'border-green-500 bg-green-500/10 text-green-300'
                                                : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-300'
                                        }`}
                                    >
                                        {cameraVisible ? '✓ Câmera Visível' : '✗ Câmera Ocultada'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
