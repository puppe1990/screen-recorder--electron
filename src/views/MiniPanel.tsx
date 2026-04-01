import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Eye,
  EyeOff,
  Monitor,
  Play,
  Square,
  StickyNote,
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

const RoundedSquareIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mx-auto"
  >
    <rect x="3" y="3" width="18" height="18" rx="6" ry="6" />
  </svg>
);

const MiniPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
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
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [focusedSourceIndex, setFocusedSourceIndex] = useState(-1);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const cleanupCaptureRef = useRef<(() => void) | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sourceDropdownRef = useRef<HTMLDivElement>(null);

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
    setIsLoadingSources(true);
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
    } finally {
      setIsLoadingSources(false);
    }
  };

  const handleDropdownKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!sourceDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setSourceDropdownOpen(true);
        setFocusedSourceIndex(0);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedSourceIndex((i) => Math.min(i + 1, sources.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedSourceIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedSourceIndex >= 0 && sources[focusedSourceIndex]) {
          setSelectedSourceId(sources[focusedSourceIndex].id);
          setSourceDropdownOpen(false);
          setFocusedSourceIndex(-1);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSourceDropdownOpen(false);
        setFocusedSourceIndex(-1);
        break;
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
    const handleClickOutside = (e: MouseEvent) => {
      if (
        sourceDropdownRef.current &&
        !sourceDropdownRef.current.contains(e.target as Node)
      ) {
        setSourceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        setIsExpanded(true);
        window.electronAPI.resizeMiniPanel(true);
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

  const sectionCardClass =
    'rounded-[28px] border border-white/8 bg-[rgba(18,23,30,0.88)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]';
  const quietButtonClass =
    'rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition duration-200 hover:border-white/18 hover:bg-white/[0.08]';
  const activeAccentButtonClass =
    'rounded-[18px] border border-cyan-300/25 bg-cyan-300/14 text-cyan-50 shadow-[0_12px_30px_rgba(110,231,249,0.12)]';
  const segmentedButtonClass =
    'rounded-[18px] border border-white/8 bg-black/20 px-3 py-3 text-sm font-semibold text-slate-300 transition duration-200 hover:border-white/16 hover:bg-white/[0.06]';
  const sectionLabelClass =
    'text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500';
  const recordingButtonClass = isRecording
    ? 'bg-[linear-gradient(135deg,#FF5D73,#D92D4A)] text-white shadow-[0_18px_40px_rgba(255,93,115,0.28)] hover:brightness-105'
    : 'bg-[linear-gradient(135deg,#6EE7F9,#35B8D6)] text-slate-950 shadow-[0_18px_40px_rgba(110,231,249,0.24)] hover:brightness-105';

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
        <div className="relative mx-auto flex h-full max-w-[1080px] flex-col overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(160deg,rgba(13,16,22,0.98),rgba(8,10,15,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.52)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(110,231,249,0.10),transparent_60%)]" />

          <div
            className={`grid items-center gap-3 px-4 ${isExpanded ? 'border-b border-white/8 py-4' : 'grid-cols-[auto,minmax(0,1fr),auto,auto] py-3'}`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${isRecording ? 'bg-[#FF5D73] shadow-[0_0_14px_rgba(255,93,115,0.95)]' : 'bg-[#8CF0C7] shadow-[0_0_10px_rgba(140,240,199,0.4)]'}`}
              />
              <p className="truncate text-sm font-semibold text-slate-50">
                {statusLabel}
              </p>
            </div>

            {!isExpanded && (
              <div className="flex min-w-0 items-center gap-3 rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={sectionLabelClass}>Fonte</p>
                  <p className="truncate text-sm font-medium text-slate-100">
                    {selectedSourceName}
                  </p>
                </div>
                <div className="h-8 w-px bg-white/8" />
                <div className="text-right">
                  <p className={sectionLabelClass}>Timer</p>
                  <p className="font-mono text-lg font-semibold tracking-[0.12em] text-white">
                    {isRecording ? formatTime(seconds) : '00:00'}
                  </p>
                </div>
              </div>
            )}

            {isExpanded && (
              <div className="grid flex-1 grid-cols-[minmax(0,1fr),auto] gap-3">
                <div className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3">
                  <p className={sectionLabelClass}>Fonte atual</p>
                  <p className="mt-1 truncate text-sm font-medium text-slate-100">
                    {selectedSourceName}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3 text-right">
                  <p className={sectionLabelClass}>Timer</p>
                  <p className="mt-1 font-mono text-lg font-semibold tracking-[0.12em] text-white">
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
                onClick={handleToggleExpand}
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded ? 'Ocultar controles' : 'Expandir controles'
                }
                className={quietButtonClass}
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
            </div>

            {!isExpanded && (
              <button
                onClick={handleToggleRecording}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                disabled={!isRecording && !selectedSourceId}
                className={`min-w-[170px] rounded-[20px] px-5 py-3.5 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${recordingButtonClass}`}
                title={
                  !isRecording && !selectedSourceId
                    ? 'Selecione uma fonte antes de gravar'
                    : isRecording
                      ? 'Parar gravação'
                      : 'Iniciar gravação'
                }
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
                className={`rounded-[22px] border px-4 py-3 text-sm ${
                  errorMessage
                    ? 'border-[#FF5D73]/40 bg-[#FF5D73]/10 text-rose-50'
                    : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-50'
                }`}
              >
                {errorMessage ?? statusMessage}
              </div>
            </div>
          )}

          {isExpanded && (
            <>
              <div className="border-t border-white/8 px-4 py-4">
                <button
                  onClick={handleToggleRecording}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  disabled={!isRecording && !selectedSourceId}
                  className={`w-full rounded-[24px] px-5 py-4 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${recordingButtonClass}`}
                  title={
                    !isRecording && !selectedSourceId
                      ? 'Selecione uma fonte antes de gravar'
                      : isRecording
                        ? 'Parar gravação'
                        : 'Iniciar gravação'
                  }
                >
                  <span className="flex items-center justify-center gap-2">
                    <Video className="h-4 w-4" />
                    {isRecording ? 'Parar gravação' : 'Iniciar gravação agora'}
                  </span>
                </button>
              </div>

              <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto border-t border-white/8 px-4 py-4 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="space-y-4">
                  <div
                    className={sectionCardClass}
                    style={
                      { WebkitAppRegion: 'no-drag' } as React.CSSProperties
                    }
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-[18px] border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-200">
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

                    <div className="relative" ref={sourceDropdownRef}>
                      <button
                        type="button"
                        id="source-dropdown-trigger"
                        disabled={isRecording || isSaving}
                        onClick={() => {
                          setSourceDropdownOpen((open) => !open);
                          setFocusedSourceIndex(0);
                        }}
                        onKeyDown={handleDropdownKeyDown}
                        aria-haspopup="listbox"
                        aria-expanded={sourceDropdownOpen}
                        aria-label="Selecionar fonte de gravação"
                        aria-controls="source-dropdown-list"
                        className="flex w-full items-center justify-between rounded-[20px] border border-white/10 bg-black/30 px-4 py-4 text-sm text-white outline-none transition duration-200 hover:border-white/[0.18] focus-visible:border-cyan-300/50 focus-visible:ring-1 focus-visible:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="truncate">
                          {isLoadingSources
                            ? 'Carregando fontes...'
                            : sources.length === 0
                              ? errorMessage
                                ? 'Nenhuma fonte disponível'
                                : 'Nenhuma fonte encontrada'
                              : selectedSourceName}
                        </span>
                        <ChevronDown
                          className={`ml-3 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${sourceDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {sourceDropdownOpen && sources.length > 0 && (
                        <ul
                          id="source-dropdown-list"
                          role="listbox"
                          aria-labelledby="source-dropdown-trigger"
                          className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-[20px] border border-white/10 bg-[rgba(13,16,22,0.98)] shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                        >
                          {sources.map((source) => (
                            <li key={source.id} role="presentation">
                              <button
                                type="button"
                                role="option"
                                aria-selected={selectedSourceId === source.id}
                                onClick={() => {
                                  setSelectedSourceId(source.id);
                                  setSourceDropdownOpen(false);
                                  setFocusedSourceIndex(-1);
                                }}
                                className={`w-full px-4 py-3.5 text-left text-sm transition duration-150 hover:bg-white/[0.06] ${
                                  selectedSourceId === source.id
                                    ? 'bg-cyan-300/[0.08] text-cyan-100'
                                    : 'text-slate-200'
                                } ${
                                  focusedSourceIndex === sources.indexOf(source)
                                    ? 'outline-none ring-1 ring-inset ring-cyan-300/30'
                                    : ''
                                }`}
                              >
                                {source.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void loadSources()}
                        disabled={isRecording || isSaving || isLoadingSources}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition duration-200 hover:border-white/18 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoadingSources
                          ? 'Atualizando...'
                          : 'Atualizar fontes'}
                      </button>
                    </div>
                  </div>

                  <div
                    className={sectionCardClass}
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
                            className={`rounded-[20px] border p-4 text-left transition duration-200 ${
                              videoFormat === format
                                ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-50'
                                : 'border-white/10 bg-black/25 text-slate-300 hover:border-white/18'
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
                    className={sectionCardClass}
                    style={
                      { WebkitAppRegion: 'no-drag' } as React.CSSProperties
                    }
                  >
                    <h2 className="text-lg font-semibold text-white">
                      Overlay da câmera
                    </h2>
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className={sectionLabelClass}>Formato</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            ['circle', 'rounded', 'square'] as CameraShape[]
                          ).map((shape) => (
                            <button
                              key={shape}
                              onClick={() => handleCameraShape(shape)}
                              className={`px-3 py-3 text-sm font-semibold transition duration-200 ${
                                cameraShape === shape
                                  ? `${segmentedButtonClass} ${activeAccentButtonClass}`
                                  : segmentedButtonClass
                              }`}
                            >
                              {shape === 'circle' && (
                                <Circle className="mx-auto h-4 w-4" />
                              )}
                              {shape === 'rounded' && <RoundedSquareIcon />}
                              {shape === 'square' && (
                                <Square className="mx-auto h-4 w-4" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className={sectionLabelClass}>Tamanho</p>
                        <div className="grid grid-cols-3 gap-2">
                          {(['small', 'medium', 'large'] as CameraSize[]).map(
                            (size) => (
                              <button
                                key={size}
                                onClick={() => handleCameraSize(size)}
                                className={`px-3 py-3 text-sm font-semibold transition duration-200 ${
                                  cameraSize === size
                                    ? `${segmentedButtonClass} ${activeAccentButtonClass}`
                                    : segmentedButtonClass
                                }`}
                              >
                                {size === 'small'
                                  ? 'Compacto'
                                  : size === 'medium'
                                    ? 'Médio'
                                    : 'Palco'}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      <button
                        onClick={handleCameraVisibility}
                        className={`w-full rounded-[20px] px-4 py-3 text-sm font-semibold transition duration-200 ${
                          cameraVisible
                            ? 'border border-emerald-300/25 bg-emerald-300/12 text-emerald-100 hover:bg-emerald-300/16'
                            : 'border border-white/10 bg-black/25 text-slate-200 hover:bg-white/[0.06]'
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

                  <div className="rounded-[28px] border border-amber-200/18 bg-[linear-gradient(160deg,rgba(243,201,122,0.10),rgba(243,201,122,0.04))] p-5 text-sm text-amber-50">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/70">
                      Áudio
                    </p>
                    <p className="mt-2">{audioNotice}</p>
                  </div>

                  <div
                    className={sectionCardClass}
                    style={
                      { WebkitAppRegion: 'no-drag' } as React.CSSProperties
                    }
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-[18px] border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-200">
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
                        className="rounded-[18px] border border-cyan-300/25 bg-cyan-300/14 px-3 py-2.5 text-xs font-semibold text-cyan-50 transition duration-200 hover:bg-cyan-300/18"
                      >
                        <span className="flex items-center gap-2">
                          <Play className="h-4 w-4" />
                          Abrir
                        </span>
                      </button>
                      <button
                        onClick={() => window.electronAPI.closeTeleprompter()}
                        className="rounded-[18px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-slate-200 transition duration-200 hover:border-white/18 hover:bg-white/[0.08]"
                      >
                        <span className="flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          Fechar
                        </span>
                      </button>
                    </div>

                    <textarea
                      className="mt-4 h-52 w-full rounded-[24px] border border-white/10 bg-black/25 px-5 py-4 text-sm leading-relaxed text-white outline-none transition duration-200 placeholder:text-slate-500 focus:border-cyan-300"
                      placeholder="Cole ou escreva o texto do teleprompter..."
                      value={teleprompterText}
                      onChange={(event) =>
                        handleTeleprompterTextChange(event.target.value)
                      }
                    />

                    {teleprompterStatus !== 'idle' && (
                      <div className="mt-3 flex items-center gap-3 text-xs">
                        <span
                          className={`rounded-full border px-2.5 py-1 ${
                            teleprompterStatus === 'error'
                              ? 'border-[#FF5D73]/60 text-rose-300'
                              : 'border-cyan-300/60 text-cyan-200'
                          }`}
                        >
                          {teleprompterStatus === 'error'
                            ? 'Erro ao sincronizar'
                            : 'Sincronizando'}
                        </span>
                        <span className="text-slate-500">
                          Atualiza o overlay do teleprompter em tempo real.
                        </span>
                      </div>
                    )}
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
