import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Eye,
  EyeOff,
  GripVertical,
  Monitor,
  MousePointer2,
  Play,
  StickyNote,
  Type,
  Video,
  XCircle,
} from 'lucide-react';
import type {
  CameraShape,
  CameraSize,
  DesktopSource,
  SaveRecordingResult,
  VideoFormat,
} from '../../electron/ipc-contract';
import PreviewPlayer from './PreviewPlayer';
import {
  getFormatHelperText,
  getSaveResultMessage,
  resolveRecorderMimeType,
  resolveSaveExtension,
} from '../lib/recording';

type PanelPhase = 'idle' | 'recording' | 'preview' | 'saving' | 'error';

interface CaptureBundle {
  stream: MediaStream;
  cleanup: () => void;
  hasSystemAudio: boolean;
  hasMicrophoneAudio: boolean;
}

const SCREEN_CAPTURE_CONSTRAINTS = {
  minWidth: 1280,
  maxWidth: 1920,
  minHeight: 720,
  maxHeight: 1080,
};

const stopTracks = (tracks: MediaStreamTrack[]) => {
  tracks.forEach((track) => {
    if (track.readyState !== 'ended') {
      track.stop();
    }
  });
};

const createCaptureBundle = async (
  selectedSourceId: string
): Promise<CaptureBundle> => {
  const screenStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // @ts-expect-error Electron desktop capture constraints
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: selectedSourceId,
      },
    },
    video: {
      // @ts-expect-error Electron desktop capture constraints
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: selectedSourceId,
        ...SCREEN_CAPTURE_CONSTRAINTS,
      },
    },
  });

  const finalStream = new MediaStream();
  screenStream.getVideoTracks().forEach((track) => finalStream.addTrack(track));

  const systemAudioTracks = screenStream.getAudioTracks();
  const audioStreams: MediaStream[] = [];

  if (systemAudioTracks.length > 0) {
    audioStreams.push(new MediaStream(systemAudioTracks));
  }

  let microphoneStream: MediaStream | null = null;
  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    if (microphoneStream.getAudioTracks().length > 0) {
      audioStreams.push(microphoneStream);
    }
  } catch {
    microphoneStream = null;
  }

  let audioContext: AudioContext | null = null;
  if (audioStreams.length > 0) {
    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    audioStreams.forEach((stream) => {
      audioContext!.createMediaStreamSource(stream).connect(destination);
    });

    destination.stream
      .getAudioTracks()
      .forEach((track) => finalStream.addTrack(track));
  }

  const cleanup = () => {
    const uniqueTracks = new Set<MediaStreamTrack>([
      ...screenStream.getTracks(),
      ...finalStream.getTracks(),
      ...audioStreams.flatMap((stream) => stream.getTracks()),
    ]);

    stopTracks([...uniqueTracks]);
    if (audioContext) {
      void audioContext.close().catch(() => undefined);
    }
  };

  return {
    stream: finalStream,
    cleanup,
    hasSystemAudio: systemAudioTracks.length > 0,
    hasMicrophoneAudio: Boolean(microphoneStream?.getAudioTracks().length),
  };
};

const MiniPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [cameraShape, setCameraShape] = useState<CameraShape>('circle');
  const [cameraSize, setCameraSize] = useState<CameraSize>('medium');
  const [cameraVisible, setCameraVisible] = useState(true);
  const [videoFormat, setVideoFormat] = useState<VideoFormat>('webm-vp9');
  const [teleprompterText, setTeleprompterText] = useState('');
  const [teleprompterStatus, setTeleprompterStatus] = useState<
    'idle' | 'sync' | 'error'
  >('idle');
  const [phase, setPhase] = useState<PanelPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState(
    'No macOS, o áudio do sistema pode depender de um driver virtual como BlackHole. O app tenta adicionar o microfone automaticamente.'
  );
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const cleanupCaptureRef = useRef<(() => void) | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isRecording = phase === 'recording';
  const isSaving = phase === 'saving';
  const showPreview = Boolean(previewBlob);
  const selectedSourceName =
    sources.find((source) => source.id === selectedSourceId)?.name ??
    'Escolha uma tela';
  const statusLabel = isRecording
    ? 'Gravando'
    : phase === 'preview'
      ? 'Preview pronto'
      : phase === 'saving'
        ? 'Salvando'
        : phase === 'error'
          ? 'Verifique o painel'
          : 'Pronto';

  const loadSources = async () => {
    try {
      const nextSources = await window.electronAPI.getSources();
      setSources(nextSources);
      setErrorMessage(null);

      if (nextSources.length > 0) {
        const preferredSource =
          nextSources.find((source) => source.id.startsWith('screen:')) ??
          nextSources[0];
        setSelectedSourceId(preferredSource.id);
        setPhase((currentPhase) =>
          currentPhase === 'error' ? 'idle' : currentPhase
        );
        return;
      }

      setSelectedSourceId('');
      setPhase('error');
      setErrorMessage('Nenhuma fonte de gravação está disponível no momento.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível listar as fontes de gravação.';
      setSelectedSourceId('');
      setPhase('error');
      setErrorMessage(message);
    }
  };

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadSources();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    const cleanupShape = window.electronAPI.onCameraShapeChange((shape) => {
      setCameraShape(shape);
    });

    return cleanupShape;
  }, []);

  useEffect(() => {
    let active = true;

    const loadTeleprompterText = async () => {
      try {
        const saved = await window.electronAPI.getTeleprompterText();
        if (active && typeof saved === 'string') {
          setTeleprompterText(saved);
        }
      } catch (error) {
        console.error(
          'Não foi possível carregar o texto do teleprompter:',
          error
        );
        if (active) {
          setTeleprompterStatus('error');
        }
      }
    };

    const cleanup = window.electronAPI.onTeleprompterTextChange(
      (nextText: string) => {
        if (!active) return;
        setTeleprompterText(nextText);
      }
    );

    void loadTeleprompterText();

    return () => {
      active = false;
      cleanup();
    };
  }, []);

  useEffect(() => {
    const syncState = async () => {
      try {
        const current = await window.electronAPI.getRecordingState();
        if (current) {
          setPhase('recording');
        }
      } catch (error) {
        console.error('Não foi possível obter o estado da gravação:', error);
      }
    };

    const cleanup = window.electronAPI.onRecordingStateChange(
      (state: boolean) => {
        setPhase((currentPhase) => {
          if (state) return 'recording';
          return currentPhase === 'preview' || currentPhase === 'saving'
            ? currentPhase
            : 'idle';
        });
        if (!state) {
          setSeconds(0);
        }
      }
    );

    void syncState();
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    window.electronAPI.broadcastRecordingState(isRecording);
  }, [isRecording]);

  useEffect(() => {
    let intervalId: number | undefined;

    if (isRecording) {
      intervalId = window.setInterval(() => {
        setSeconds((current) => current + 1);
      }, 1000);
      return () => {
        window.clearInterval(intervalId);
      };
    }

    return undefined;
  }, [isRecording]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCameraShape = (shape: CameraShape) => {
    setCameraShape(shape);
    window.electronAPI.setCameraShape(shape);
  };

  const handleCameraSize = (size: CameraSize) => {
    setCameraSize(size);
    window.electronAPI.setCameraSize(size);
  };

  const handleCameraVisibility = () => {
    const nextVisibility = !cameraVisible;
    setCameraVisible(nextVisibility);

    if (nextVisibility) {
      window.electronAPI.showCameraWindow();
      return;
    }

    window.electronAPI.hideCameraWindow();
  };

  const clearMessages = () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setSaveError(null);
  };

  const handleToggleExpand = () => {
    const nextExpanded = !isExpanded;
    setIsExpanded(nextExpanded);
    window.electronAPI.resizeMiniPanel(nextExpanded);
  };

  const closePreview = () => {
    setPreviewBlob(null);
    setSaveError(null);
    setPhase('idle');
    setSeconds(0);
  };

  const handleSaveRecording = async (format: VideoFormat) => {
    if (!previewBlob) return;

    setPhase('saving');
    setSaveError(null);
    setStatusMessage(null);

    const result: SaveRecordingResult = await window.electronAPI.saveRecording({
      buffer: await previewBlob.arrayBuffer(),
      format,
    });

    if (result.ok) {
      setStatusMessage(getSaveResultMessage(result));
      closePreview();
      return;
    }

    if (result.code === 'CANCELLED') {
      setPhase('preview');
      setStatusMessage(getSaveResultMessage(result));
      return;
    }

    setPhase('preview');
    setSaveError(getSaveResultMessage(result));
  };

  async function startRecording() {
    if (!selectedSourceId) {
      setPhase('error');
      setErrorMessage(
        sources.length === 0
          ? 'Nenhuma fonte de gravação está disponível. Atualize a lista e confirme as permissões do sistema.'
          : 'Selecione uma fonte de gravação antes de iniciar.'
      );
      return;
    }

    clearMessages();
    let captureBundle: CaptureBundle | null = null;

    try {
      captureBundle = await createCaptureBundle(selectedSourceId);
      cleanupCaptureRef.current = captureBundle.cleanup;

      const mimeType = resolveRecorderMimeType(
        videoFormat,
        captureBundle.stream.getAudioTracks().length > 0,
        (candidate) => MediaRecorder.isTypeSupported(candidate)
      );

      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: 2_500_000,
      };

      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      if (captureBundle.stream.getAudioTracks().length > 0) {
        recorderOptions.audioBitsPerSecond = 128_000;
      }

      const recorder = new MediaRecorder(captureBundle.stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        cleanupCaptureRef.current?.();
        cleanupCaptureRef.current = null;
        setPreviewBlob(new Blob(chunksRef.current, { type: 'video/webm' }));
        setPhase('preview');
      };

      recorder.onerror = () => {
        cleanupCaptureRef.current?.();
        cleanupCaptureRef.current = null;
        setPhase('error');
        setErrorMessage(
          'A gravação falhou antes de finalizar. Tente novamente.'
        );
      };

      recorder.start(1000);
      setSeconds(0);
      setPhase('recording');
      setAudioNotice(
        captureBundle.hasSystemAudio
          ? captureBundle.hasMicrophoneAudio
            ? 'Áudio do sistema e microfone adicionados à gravação.'
            : 'Áudio do sistema detectado. O microfone não foi incluído.'
          : captureBundle.hasMicrophoneAudio
            ? 'Sem áudio do sistema. O app adicionou o microfone à gravação.'
            : 'Nenhuma fonte de áudio disponível. A gravação seguirá sem áudio.'
      );
      setIsExpanded(false);
      window.electronAPI.resizeMiniPanel(false);
    } catch (error) {
      captureBundle?.cleanup();
      cleanupCaptureRef.current = null;
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao iniciar a gravação.';
      setPhase('error');
      setErrorMessage(message);
      setSeconds(0);
    }
  }

  const handleTeleprompterTextChange = (value: string) => {
    setTeleprompterText(value);
    setTeleprompterStatus('sync');

    try {
      window.electronAPI.setTeleprompterText(value);
      window.setTimeout(() => {
        setTeleprompterStatus('idle');
      }, 400);
    } catch (error) {
      console.error('Falha ao sincronizar o teleprompter:', error);
      setTeleprompterStatus('error');
    }
  };

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setSeconds(0);
  }

  useEffect(() => {
    const cleanupStart = window.electronAPI.onStartRecordingTrigger(() => {
      void startRecording();
    });

    const cleanupStop = window.electronAPI.onStopRecordingTrigger(() => {
      stopRecording();
    });

    return () => {
      cleanupStart();
      cleanupStop();
    };
  });

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    void startRecording();
  };

  return (
    <>
      {showPreview && previewBlob && (
        <PreviewPlayer
          videoBlob={previewBlob}
          onSave={handleSaveRecording}
          onCancel={closePreview}
          isSaving={isSaving}
          saveError={saveError}
        />
      )}

      <div
        className="h-screen w-screen overflow-hidden bg-transparent px-3 py-3 text-white"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="relative mx-auto flex h-full max-w-[1040px] flex-col overflow-hidden rounded-[26px] border border-slate-700/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(8,15,32,0.98))] shadow-[0_28px_70px_rgba(15,23,42,0.42)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

          <div
            className={`grid items-center gap-3 px-4 ${isExpanded ? 'border-b border-slate-800/90 py-4' : 'grid-cols-[auto,minmax(0,1fr),auto,auto] py-3'}`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/90 text-slate-400">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-500">
                  Studio strip
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]' : 'bg-emerald-400'}`}
                  />
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {statusLabel}
                  </p>
                </div>
              </div>
            </div>

            {!isExpanded && (
              <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Fonte
                  </p>
                  <p className="truncate text-sm font-medium text-slate-100">
                    {selectedSourceName}
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Timer
                  </p>
                  <p className="font-mono text-lg font-semibold tracking-[0.16em] text-white">
                    {isRecording ? formatTime(seconds) : '00:00'}
                  </p>
                </div>
              </div>
            )}

            {isExpanded && (
              <div className="grid flex-1 grid-cols-[minmax(0,1fr),auto] gap-3">
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/65 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Fonte atual
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-slate-100">
                    {selectedSourceName}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/65 px-4 py-3 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Timer
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold tracking-[0.16em] text-white">
                    {isRecording ? formatTime(seconds) : '00:00'}
                  </p>
                </div>
              </div>
            )}

            <div
              className={`flex items-center gap-2 ${isExpanded ? 'justify-end' : ''}`}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <button
                onClick={() => {
                  if (!isExpanded) {
                    setIsExpanded(true);
                    window.electronAPI.resizeMiniPanel(true);
                  }
                }}
                className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/18 px-3 py-2.5 text-xs font-semibold text-fuchsia-100 transition-colors hover:bg-fuchsia-500/28"
              >
                <span className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Teleprompter
                </span>
              </button>

              <button
                onClick={handleToggleExpand}
                className="rounded-2xl border border-slate-700 bg-slate-900/90 px-3 py-2.5 text-xs font-semibold text-slate-100 transition-colors hover:border-slate-600 hover:bg-slate-800"
              >
                <span className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {isExpanded ? 'Ocultar controles' : 'Expandir controles'}
                </span>
              </button>

              <button
                onClick={() => window.electronAPI.resizeMiniPanel(true)}
                className="rounded-2xl border border-slate-700 bg-slate-900/90 p-2.5 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                title="Expandir este painel"
              >
                <Monitor className="h-4 w-4" />
              </button>
            </div>

            {!isExpanded && (
              <button
                onClick={handleToggleRecording}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg transition-all ${
                  isRecording
                    ? 'bg-gradient-to-r from-rose-600 to-red-700 text-white hover:from-rose-700 hover:to-red-800'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'
                }`}
                title={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
              >
                <span className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  {isRecording ? 'Parar' : 'Gravar'}
                </span>
              </button>
            )}
          </div>

          {(errorMessage || statusMessage) && (
            <div className="px-4 pb-3">
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  errorMessage
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                }`}
              >
                {errorMessage ?? statusMessage}
              </div>
            </div>
          )}

          {isExpanded && (
            <>
              <div className="border-t border-slate-800/90 px-4 py-4">
                <button
                  onClick={handleToggleRecording}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  className={`w-full rounded-[22px] px-5 py-4 text-sm font-semibold shadow-lg transition-all ${
                    isRecording
                      ? 'bg-gradient-to-r from-rose-600 to-red-700 text-white hover:from-rose-700 hover:to-red-800'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700'
                  }`}
                  title={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Video className="h-4 w-4" />
                    {isRecording ? 'Parar gravação' : 'Iniciar gravação agora'}
                  </span>
                </button>
              </div>

              <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto border-t border-slate-800/90 px-4 py-4 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="space-y-4">
                  <div
                    className="rounded-[26px] border border-slate-800/80 bg-slate-900/58 p-5"
                    style={
                      { WebkitAppRegion: 'no-drag' } as React.CSSProperties
                    }
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300">
                        <Monitor className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Fonte de gravação
                        </h2>
                        <p className="text-sm text-slate-400">
                          Escolha a tela certa sem sair do mini painel.
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <select
                        className="w-full appearance-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 pr-12 text-sm text-white outline-none transition-colors hover:border-slate-600 focus:border-blue-500"
                        value={selectedSourceId}
                        onChange={(event) =>
                          setSelectedSourceId(event.target.value)
                        }
                      >
                        {sources.length === 0 ? (
                          <option value="">
                            {errorMessage
                              ? 'Nenhuma fonte disponível'
                              : 'Carregando fontes...'}
                          </option>
                        ) : (
                          sources.map((source) => (
                            <option key={source.id} value={source.id}>
                              {source.name}
                            </option>
                          ))
                        )}
                      </select>
                      <MousePointer2 className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void loadSources()}
                        disabled={isRecording || isSaving}
                        className="rounded-full border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Atualizar fontes
                      </button>
                    </div>
                  </div>

                  <div
                    className="rounded-[26px] border border-slate-800/80 bg-slate-900/58 p-5"
                    style={
                      { WebkitAppRegion: 'no-drag' } as React.CSSProperties
                    }
                  >
                    <h2 className="text-lg font-semibold text-white">
                      Formato de exportação
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Escolha o container antes de gravar.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      {(['webm-vp9', 'webm-vp8', 'mp4'] as VideoFormat[]).map(
                        (format) => (
                          <button
                            key={format}
                            type="button"
                            disabled={isRecording}
                            onClick={() => setVideoFormat(format)}
                            className={`rounded-2xl border p-4 text-left transition-all ${
                              videoFormat === format
                                ? 'border-blue-500 bg-blue-500/10 text-blue-100'
                                : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <p className="font-semibold">
                              {format === 'webm-vp9' && 'WebM (VP9)'}
                              {format === 'webm-vp8' && 'WebM (VP8)'}
                              {format === 'mp4' && 'MP4 (H.264)'}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {getFormatHelperText(format)}
                            </p>
                          </button>
                        )
                      )}
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      Extensão final: .{resolveSaveExtension(videoFormat)}
                    </p>
                  </div>
                </section>

                <aside className="space-y-4">
                  <div
                    className="rounded-[26px] border border-slate-800/80 bg-slate-900/58 p-5"
                    style={
                      { WebkitAppRegion: 'no-drag' } as React.CSSProperties
                    }
                  >
                    <h2 className="text-lg font-semibold text-white">
                      Overlay da câmera
                    </h2>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Formato
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            ['circle', 'rounded', 'square'] as CameraShape[]
                          ).map((shape) => (
                            <button
                              key={shape}
                              onClick={() => handleCameraShape(shape)}
                              className={`rounded-2xl px-3 py-3 text-sm font-semibold transition-colors ${
                                cameraShape === shape
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              {shape === 'circle' && (
                                <Circle className="mx-auto h-4 w-4" />
                              )}
                              {shape === 'rounded' && 'Arred.'}
                              {shape === 'square' && 'Quadr.'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Tamanho
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['small', 'medium', 'large'] as CameraSize[]).map(
                            (size) => (
                              <button
                                key={size}
                                onClick={() => handleCameraSize(size)}
                                className={`rounded-2xl px-3 py-3 text-sm font-semibold uppercase transition-colors ${
                                  cameraSize === size
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                {size === 'small'
                                  ? 'P'
                                  : size === 'medium'
                                    ? 'M'
                                    : 'G'}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <button
                        onClick={handleCameraVisibility}
                        className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                          cameraVisible
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-slate-950 text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          {cameraVisible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                          {cameraVisible ? 'Ocultar câmera' : 'Mostrar câmera'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-50">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/70">
                      Áudio
                    </p>
                    <p className="mt-2">{audioNotice}</p>
                  </div>

                  <div
                    className="rounded-[26px] border border-slate-800/80 bg-slate-900/58 p-5"
                    style={
                      { WebkitAppRegion: 'no-drag' } as React.CSSProperties
                    }
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-2 text-fuchsia-300">
                        <StickyNote className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-white">
                          Teleprompter
                        </h2>
                        <p className="text-sm text-slate-400">
                          Edite o roteiro e controle a janela daqui.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => window.electronAPI.openTeleprompter()}
                        className="rounded-2xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                      >
                        <span className="flex items-center gap-2">
                          <Play className="h-4 w-4" />
                          Abrir
                        </span>
                      </button>
                      <button
                        onClick={() => window.electronAPI.closeTeleprompter()}
                        className="rounded-2xl bg-rose-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
                      >
                        <span className="flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          Fechar
                        </span>
                      </button>
                    </div>

                    <textarea
                      className="mt-4 h-52 w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-4 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-slate-500 focus:border-fuchsia-500"
                      placeholder="Cole ou escreva o texto do teleprompter..."
                      value={teleprompterText}
                      onChange={(event) =>
                        handleTeleprompterTextChange(event.target.value)
                      }
                    />

                    <div className="mt-3 flex items-center gap-3 text-xs">
                      <span
                        className={`rounded-full border px-2.5 py-1 ${
                          teleprompterStatus === 'error'
                            ? 'border-rose-500/60 text-rose-300'
                            : teleprompterStatus === 'sync'
                              ? 'border-emerald-500/60 text-emerald-300'
                              : 'border-slate-700 text-slate-400'
                        }`}
                      >
                        {teleprompterStatus === 'error'
                          ? 'Erro ao sincronizar'
                          : teleprompterStatus === 'sync'
                            ? 'Sincronizando'
                            : 'Pronto'}
                      </span>
                      <span className="text-slate-500">
                        Atualiza o overlay do teleprompter em tempo real.
                      </span>
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default MiniPanel;
