import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Eye,
  EyeOff,
  Pause,
  Play,
  RotateCcw,
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
  const [videoFormat, setVideoFormat] = useState<VideoFormat>('mp4');
  const [teleprompterText, setTeleprompterText] = useState('');
  const [teleprompterStatus, setTeleprompterStatus] = useState<
    'idle' | 'sync' | 'error'
  >('idle');
  const [teleprompterIsOpen, setTeleprompterIsOpen] = useState(false);
  const [teleprompterIsRunning, setTeleprompterIsRunning] = useState(false);
  const [teleprompterIsDone, setTeleprompterIsDone] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(1);
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
  const teleprompterSpeedRef = useRef(1);

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
    const unsubOpened = window.electronAPI.onTeleprompterWindowOpened(() => {
      setTeleprompterIsOpen(true);
      setTeleprompterIsRunning(true);
      setTeleprompterIsDone(false);
      window.electronAPI.teleprompterSetSpeed(teleprompterSpeedRef.current);
    });

    const unsubClosed = window.electronAPI.onTeleprompterWindowClosed(() => {
      setTeleprompterIsOpen(false);
      setTeleprompterIsRunning(false);
      setTeleprompterIsDone(false);
    });

    const unsubDone = window.electronAPI.onTeleprompterScrollDone(() => {
      setTeleprompterIsRunning(false);
      setTeleprompterIsDone(true);
    });

    return () => {
      unsubOpened();
      unsubClosed();
      unsubDone();
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

  const handleTeleprompterToggle = () => {
    if (teleprompterIsOpen) {
      window.electronAPI.closeTeleprompter();
    } else {
      window.electronAPI.openTeleprompter();
    }
  };

  const handleTeleprompterPlay = () => {
    setTeleprompterIsRunning(true);
    setTeleprompterIsDone(false);
    window.electronAPI.teleprompterPlay();
  };

  const handleTeleprompterPause = () => {
    setTeleprompterIsRunning(false);
    window.electronAPI.teleprompterPause();
  };

  // Stop = pause + go to beginning
  const handleTeleprompterStop = () => {
    setTeleprompterIsRunning(false);
    setTeleprompterIsDone(false);
    window.electronAPI.teleprompterReset();
  };

  // Restart = go to beginning + auto-play
  const handleTeleprompterRestart = () => {
    setTeleprompterIsRunning(true);
    setTeleprompterIsDone(false);
    window.electronAPI.teleprompterReset();
    window.electronAPI.teleprompterPlay();
  };

  const handleTeleprompterSpeedChange = (value: number) => {
    teleprompterSpeedRef.current = value;
    setTeleprompterSpeed(value);
    window.electronAPI.teleprompterSetSpeed(value);
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

  const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <>
      {showPreview && previewBlob && (
        <PreviewPlayer
          videoBlob={previewBlob}
          onSave={handleSaveRecording}
          onCancel={closePreview}
          isSaving={isSaving}
          saveError={saveError}
          initialFormat={videoFormat}
        />
      )}

      <div className="app-shell h-screen w-screen px-2.5 py-2.5">
        <div className="panel-frame mx-auto flex h-full max-w-[1040px] flex-col">
          {/* Toolbar */}
          <header
            className={`flex shrink-0 items-center gap-3 px-3.5 ${isExpanded ? 'border-b border-[var(--border-subtle)] py-3.5' : 'py-2.5'}`}
          >
            <div className="flex min-w-0 items-center gap-2.5" style={drag}>
              <span
                className={`status-dot ${isRecording ? 'status-dot-recording' : 'status-dot-idle'}`}
              />
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                {statusLabel}
              </span>
            </div>

            {!isExpanded && (
              <>
                <div
                  className="surface-inset flex min-w-0 flex-1 items-center gap-4 px-3.5 py-2"
                  style={drag}
                >
                  <div className="min-w-0 flex-1">
                    <p className="label-caps">Fonte</p>
                    <p className="truncate text-sm text-[var(--text-primary)]">
                      {selectedSourceName}
                    </p>
                  </div>
                  <div className="h-6 w-px bg-[var(--border-subtle)]" />
                  <div className="shrink-0 text-right">
                    <p className="label-caps">Timer</p>
                    <p className="font-mono text-base font-semibold tabular-nums text-[var(--text-primary)]">
                      {isRecording ? formatTime(seconds) : '00:00'}
                    </p>
                  </div>
                </div>

                <div
                  className="flex shrink-0 items-center gap-2"
                  style={noDrag}
                >
                  <button
                    onClick={handleTeleprompterToggle}
                    className={`btn px-3 py-2 text-sm ${
                      teleprompterIsOpen ? 'btn-accent' : 'btn-ghost'
                    }`}
                    title={
                      teleprompterIsOpen
                        ? 'Fechar teleprompter'
                        : 'Abrir teleprompter'
                    }
                  >
                    <StickyNote className="h-4 w-4" />
                    <span className="hidden sm:inline">Script</span>
                  </button>

                  <button
                    onClick={handleToggleExpand}
                    aria-expanded={isExpanded}
                    aria-label="Expandir controles"
                    className="btn-ghost px-2.5 py-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  <button
                    onClick={handleToggleRecording}
                    disabled={!isRecording && !selectedSourceId}
                    className={`btn px-4 py-2 text-sm ${isRecording ? 'btn-stop' : 'btn-record'}`}
                    title={
                      !isRecording && !selectedSourceId
                        ? 'Selecione uma fonte antes de gravar'
                        : isRecording
                          ? 'Parar gravação'
                          : 'Iniciar gravação'
                    }
                  >
                    {isRecording ? (
                      <Square className="h-4 w-4 fill-current" />
                    ) : (
                      <Video className="h-4 w-4" />
                    )}
                    {isRecording ? 'Parar' : 'Gravar'}
                  </button>
                </div>
              </>
            )}

            {isExpanded && (
              <>
                <div
                  className="flex min-w-0 flex-1 items-center gap-3"
                  style={drag}
                >
                  <div className="surface-inset min-w-0 flex-1 px-3.5 py-2">
                    <p className="label-caps">Fonte</p>
                    <p className="truncate text-sm text-[var(--text-primary)]">
                      {selectedSourceName}
                    </p>
                  </div>
                  <div className="surface-inset shrink-0 px-3.5 py-2 text-right">
                    <p className="label-caps">Timer</p>
                    <p className="font-mono text-base font-semibold tabular-nums">
                      {isRecording ? formatTime(seconds) : '00:00'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleExpand}
                  aria-expanded={isExpanded}
                  aria-label="Ocultar controles"
                  className="btn-ghost shrink-0 px-3 py-2 text-sm"
                  style={noDrag}
                >
                  <ChevronUp className="h-4 w-4" />
                  Ocultar
                </button>
              </>
            )}
          </header>

          {(errorMessage || statusMessage) && (
            <div className="px-3.5 pb-2.5">
              <div
                className={`px-3.5 py-2.5 text-sm ${errorMessage ? 'alert-error' : 'alert-info'}`}
              >
                {errorMessage ?? statusMessage}
              </div>
            </div>
          )}

          {isExpanded && (
            <div
              className="flex min-h-0 flex-1 flex-col"
              data-testid="expanded-controls"
              style={noDrag}
            >
              <div className="border-b border-[var(--border-subtle)] px-3.5 py-3">
                <button
                  onClick={handleToggleRecording}
                  disabled={!isRecording && !selectedSourceId}
                  className={`btn w-full py-3 text-sm ${isRecording ? 'btn-stop' : 'btn-record'}`}
                  title={
                    !isRecording && !selectedSourceId
                      ? 'Selecione uma fonte antes de gravar'
                      : isRecording
                        ? 'Parar gravação'
                        : 'Iniciar gravação'
                  }
                >
                  {isRecording ? (
                    <Square className="h-4 w-4 fill-current" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                  {isRecording ? 'Parar gravação' : 'Iniciar gravação'}
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto p-3.5 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="space-y-3">
                  <div className="surface p-4">
                    <div className="mb-4">
                      <h2 className="text-base font-semibold text-[var(--text-primary)]">
                        Fonte de gravação
                      </h2>
                      <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                        Escolha a tela ou janela para capturar.
                      </p>
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
                        className="input-field flex items-center justify-between py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
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
                          className={`ml-3 h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${sourceDropdownOpen ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {sourceDropdownOpen && sources.length > 0 && (
                        <ul
                          id="source-dropdown-list"
                          role="listbox"
                          aria-labelledby="source-dropdown-trigger"
                          className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden border border-[var(--border-default)] bg-[var(--bg-overlay)] shadow-panel"
                          style={{ borderRadius: 'var(--radius-md)' }}
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
                                className={`w-full px-3.5 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-white/[0.04] ${
                                  selectedSourceId === source.id
                                    ? 'bg-[var(--accent-muted)] text-indigo-100'
                                    : 'text-[var(--text-secondary)]'
                                } ${
                                  focusedSourceIndex === sources.indexOf(source)
                                    ? 'ring-1 ring-inset ring-[var(--accent-border)]'
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
                        className="btn-ghost px-3 py-1.5 text-xs"
                      >
                        {isLoadingSources
                          ? 'Atualizando...'
                          : 'Atualizar fontes'}
                      </button>
                    </div>
                  </div>

                  <div className="surface p-4">
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">
                      Formato de exportação
                    </h2>
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                      Container usado ao salvar a gravação.
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      {(['webm-vp9', 'webm-vp8', 'mp4'] as VideoFormat[]).map(
                        (format) => (
                          <button
                            key={format}
                            type="button"
                            data-testid={`export-format-${format}`}
                            style={noDrag}
                            disabled={isRecording}
                            onClick={() => setVideoFormat(format)}
                            aria-pressed={videoFormat === format}
                            className={`surface-inset p-3.5 text-left transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                              videoFormat === format
                                ? 'border-[var(--accent-border)] bg-[var(--accent-muted)]'
                                : 'hover:border-[var(--border-strong)]'
                            }`}
                          >
                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                              {format === 'webm-vp9' && 'WebM (VP9)'}
                              {format === 'webm-vp8' && 'WebM (VP8)'}
                              {format === 'mp4' && 'MP4 (H.264)'}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                              {getFormatHelperText(format)}
                            </p>
                          </button>
                        )
                      )}
                    </div>

                    <p className="mt-2.5 text-xs text-[var(--text-muted)]">
                      Extensão: .{resolveSaveExtension(videoFormat)}
                    </p>
                  </div>
                </section>

                <aside className="space-y-3">
                  <div className="surface p-4">
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">
                      Overlay da câmera
                    </h2>
                    <div className="mt-3 space-y-3.5">
                      <div>
                        <p className="label-caps mb-2">Formato</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            ['circle', 'rounded', 'square'] as CameraShape[]
                          ).map((shape) => (
                            <button
                              key={shape}
                              onClick={() => handleCameraShape(shape)}
                              className={`btn-segment ${cameraShape === shape ? 'btn-segment-active' : ''}`}
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
                        <p className="label-caps mb-2">Tamanho</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['small', 'medium', 'large'] as CameraSize[]).map(
                            (size) => (
                              <button
                                key={size}
                                onClick={() => handleCameraSize(size)}
                                className={`btn-segment ${cameraSize === size ? 'btn-segment-active' : ''}`}
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
                        className={`btn w-full py-2.5 text-sm ${
                          cameraVisible
                            ? 'border-[var(--success-muted)] bg-[var(--success-muted)] text-green-100 hover:bg-green-500/20'
                            : 'btn-ghost'
                        }`}
                      >
                        {cameraVisible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                        {cameraVisible ? 'Ocultar câmera' : 'Mostrar câmera'}
                      </button>
                    </div>
                  </div>

                  <div className="alert-warning p-4 text-sm">
                    <p className="label-caps text-amber-200/80">Áudio</p>
                    <p className="mt-1.5 leading-relaxed">{audioNotice}</p>
                  </div>

                  <div className="surface p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <h2 className="flex-1 text-base font-semibold text-[var(--text-primary)]">
                        Teleprompter
                      </h2>
                      {teleprompterIsOpen &&
                        (teleprompterIsDone ? (
                          <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-200">
                            Concluído
                          </span>
                        ) : teleprompterIsRunning ? (
                          <span className="flex items-center gap-1 rounded-full border border-green-500/30 bg-[var(--success-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-200">
                            <span className="status-dot status-dot-recording !h-1.5 !w-1.5 bg-green-400 shadow-green-400/50" />
                            Ao vivo
                          </span>
                        ) : (
                          <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                            Pausado
                          </span>
                        ))}
                      <button
                        onClick={handleTeleprompterToggle}
                        className={`btn px-2.5 py-1.5 text-xs ${teleprompterIsOpen ? 'btn-ghost' : 'btn-accent'}`}
                        title={
                          teleprompterIsOpen ? 'Fechar janela' : 'Abrir janela'
                        }
                      >
                        {teleprompterIsOpen ? (
                          <XCircle className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        {teleprompterIsOpen ? 'Fechar' : 'Abrir'}
                      </button>
                    </div>

                    <div
                      className={`mb-3 space-y-2.5 transition-opacity duration-200 ${teleprompterIsOpen ? 'opacity-100' : 'pointer-events-none opacity-30'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={
                            teleprompterIsRunning
                              ? handleTeleprompterPause
                              : handleTeleprompterPlay
                          }
                          className="btn-accent flex-1 py-2 text-xs"
                          title={
                            teleprompterIsRunning
                              ? 'Pausar (Space)'
                              : 'Iniciar (Space)'
                          }
                        >
                          {teleprompterIsRunning ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          {teleprompterIsRunning ? 'Pausar' : 'Iniciar'}
                        </button>

                        <button
                          onClick={handleTeleprompterRestart}
                          className="btn-ghost flex-1 py-2 text-xs"
                          title="Reiniciar do início"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reiniciar
                        </button>

                        <button
                          onClick={handleTeleprompterStop}
                          className="btn-ghost px-2.5 py-2 text-[var(--text-muted)]"
                          title="Parar e voltar ao início"
                        >
                          <Square className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="surface-inset flex items-center gap-2.5 px-3 py-2">
                        <span className="text-xs text-[var(--text-muted)]">
                          Velocidade
                        </span>
                        <input
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.1"
                          value={teleprompterSpeed}
                          onChange={(e) =>
                            handleTeleprompterSpeedChange(
                              Number(e.target.value)
                            )
                          }
                          className="range-track flex-1"
                          aria-label="Velocidade do teleprompter"
                        />
                        <span className="w-8 text-right font-mono text-xs font-semibold tabular-nums">
                          {teleprompterSpeed.toFixed(1)}x
                        </span>
                      </div>
                    </div>

                    <textarea
                      className="input-field h-32 resize-none leading-relaxed"
                      placeholder="Cole ou escreva o roteiro aqui..."
                      value={teleprompterText}
                      onChange={(event) =>
                        handleTeleprompterTextChange(event.target.value)
                      }
                    />

                    {teleprompterStatus !== 'idle' && (
                      <p
                        className={`mt-1.5 text-xs ${teleprompterStatus === 'error' ? 'text-red-400' : 'text-indigo-300/80'}`}
                      >
                        {teleprompterStatus === 'error'
                          ? 'Erro ao sincronizar'
                          : 'Sincronizado'}
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MiniPanel;
