import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Circle,
  Eye,
  EyeOff,
  Minimize2,
  Monitor,
  MousePointer2,
  Type,
  Video,
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
  systemAudioTracks.forEach((track) => {
    track.enabled = true;
  });

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

const ControlPanel = () => {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [cameraShape, setCameraShape] = useState<CameraShape>('circle');
  const [cameraSize, setCameraSize] = useState<CameraSize>('medium');
  const [cameraVisible, setCameraVisible] = useState(true);
  const [videoFormat, setVideoFormat] = useState<VideoFormat>('webm-vp9');
  const [phase, setPhase] = useState<PanelPhase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState(
    'No macOS, o áudio do sistema pode não estar disponível sem um driver virtual como BlackHole. O app tenta adicionar o microfone automaticamente.'
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cleanupCaptureRef = useRef<(() => void) | null>(null);

  const isRecording = phase === 'recording';
  const isSaving = phase === 'saving';

  const loadSources = useCallback(async () => {
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
      window.electronAPI.showControlWindow();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível listar as fontes de gravação.';
      setSources([]);
      setSelectedSourceId('');
      setPhase('error');
      setErrorMessage(message);
      window.electronAPI.showControlWindow();
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadSources();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [loadSources]);

  useEffect(() => {
    const cleanupShape = window.electronAPI.onCameraShapeChange((shape) => {
      setCameraShape(shape);
    });

    return cleanupShape;
  }, []);

  useEffect(() => {
    window.electronAPI.broadcastRecordingState(isRecording);
  }, [isRecording]);

  const handleCameraShape = (shape: CameraShape) => {
    setCameraShape(shape);
    window.electronAPI.setCameraShape(shape);
  };

  const handleCameraSize = (size: CameraSize) => {
    setCameraSize(size);
    window.electronAPI.setCameraSize(size);
  };

  const toggleCameraVisibility = () => {
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

  const startRecording = useCallback(async () => {
    if (!selectedSourceId) {
      setPhase('error');
      setErrorMessage(
        sources.length === 0
          ? 'Nenhuma fonte de gravação está disponível. Atualize a lista e confirme as permissões do sistema.'
          : 'Selecione uma fonte de gravação antes de iniciar.'
      );
      window.electronAPI.showControlWindow();
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
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setPreviewBlob(blob);
        setShowPreview(true);
        setPhase('preview');
        window.electronAPI.hideTimer();
        window.electronAPI.showControlWindow();
      };

      recorder.onerror = () => {
        cleanupCaptureRef.current?.();
        cleanupCaptureRef.current = null;
        setPhase('error');
        setErrorMessage(
          'A gravação falhou antes de finalizar. Tente novamente.'
        );
        window.electronAPI.showControlWindow();
      };

      recorder.start(1000);
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
      window.electronAPI.showMiniPanel();
      window.electronAPI.hideControlWindow();
    } catch (error) {
      captureBundle?.cleanup();
      cleanupCaptureRef.current = null;
      const message =
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao iniciar a gravação.';
      setPhase('error');
      setErrorMessage(message);
      window.electronAPI.showControlWindow();
    }
  }, [selectedSourceId, sources.length, videoFormat]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setPhase((currentPhase) =>
      currentPhase === 'saving' ? currentPhase : 'idle'
    );
  }, []);

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
  }, [startRecording, stopRecording]);

  const closePreview = () => {
    setShowPreview(false);
    setPreviewBlob(null);
    setSaveError(null);
    setPhase('idle');
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

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-3 shadow-lg shadow-blue-500/30">
                <Video className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="bg-gradient-to-r from-white via-blue-100 to-blue-300 bg-clip-text text-4xl font-bold text-transparent">
                  Studio Recorder
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Gravação de tela com câmera, preview e teleprompter.
                </p>
              </div>
            </div>

            <button
              onClick={() => window.electronAPI.showMiniPanel()}
              className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
            >
              <Minimize2 className="h-5 w-5" />
              Mini Painel
            </button>
          </header>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <section className="space-y-6 xl:col-span-2">
              {(errorMessage || statusMessage) && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    errorMessage
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                  }`}
                >
                  {errorMessage ?? statusMessage}
                </div>
              )}

              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-8 shadow-2xl backdrop-blur-xl">
                <div className="mb-8 flex items-center gap-3">
                  <div className="rounded-xl bg-blue-500/20 p-2.5">
                    <Monitor className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Gravação</h2>
                    <p className="text-sm text-slate-400">
                      Selecione a tela, ajuste a câmera e inicie quando estiver
                      pronto.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-300">
                      Fonte de gravação
                    </label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none rounded-xl border-2 border-slate-700 bg-slate-900/80 p-4 pr-12 text-base text-white outline-none transition-all hover:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
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
                            <option
                              key={source.id}
                              value={source.id}
                              className="bg-slate-800"
                            >
                              {source.name}
                            </option>
                          ))
                        )}
                      </select>
                      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <MousePointer2 className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void loadSources()}
                        disabled={isRecording || isSaving}
                        className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Atualizar fontes
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-semibold text-slate-300">
                      Formato de exportação
                    </label>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      {(['webm-vp9', 'webm-vp8', 'mp4'] as VideoFormat[]).map(
                        (format) => (
                          <button
                            key={format}
                            type="button"
                            disabled={isRecording}
                            onClick={() => setVideoFormat(format)}
                            className={`rounded-xl border-2 p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                              videoFormat === format
                                ? 'border-blue-500 bg-blue-500/10 text-blue-200'
                                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <div className="font-semibold">
                              {format === 'webm-vp9' && 'WebM (VP9)'}
                              {format === 'webm-vp8' && 'WebM (VP8)'}
                              {format === 'mp4' && 'MP4 (H.264)'}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {getFormatHelperText(format)}
                            </div>
                          </button>
                        )
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Extensão final: .{resolveSaveExtension(videoFormat)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-50">
                    <p className="font-semibold">Áudio no macOS</p>
                    <p className="mt-1 text-amber-100/90">{audioNotice}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() =>
                        window.electronAPI.openTeleprompterControl()
                      }
                      className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
                    >
                      <Type className="h-4 w-4" />
                      Teleprompter
                    </button>

                    <button
                      onClick={toggleCameraVisibility}
                      className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                        cameraVisible
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-slate-700 text-slate-100 hover:bg-slate-600'
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
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-6 shadow-2xl backdrop-blur-xl">
                <h3 className="mb-4 text-lg font-semibold text-white">
                  Overlay da câmera
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Formato
                    </p>
                    <div className="flex gap-2">
                      {(['circle', 'rounded', 'square'] as CameraShape[]).map(
                        (shape) => (
                          <button
                            key={shape}
                            onClick={() => handleCameraShape(shape)}
                            className={`flex-1 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                              cameraShape === shape
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {shape === 'circle' && (
                              <Circle className="mx-auto h-4 w-4" />
                            )}
                            {shape === 'rounded' && <span>Arred.</span>}
                            {shape === 'square' && <span>Quadr.</span>}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Tamanho
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'medium', 'large'] as CameraSize[]).map(
                        (size) => (
                          <button
                            key={size}
                            onClick={() => handleCameraSize(size)}
                            className={`rounded-xl px-3 py-3 text-sm font-semibold uppercase transition-colors ${
                              cameraSize === size
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-900/80 text-slate-300 hover:bg-slate-700'
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
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-6 shadow-2xl backdrop-blur-xl">
                <h3 className="mb-2 text-lg font-semibold text-white">
                  Status
                </h3>
                <p className="text-sm text-slate-400">
                  {phase === 'recording' &&
                    'Gravando agora. Use o mini painel ou este painel para parar.'}
                  {phase === 'preview' &&
                    'Preview pronto. Revise o vídeo antes de salvar.'}
                  {phase === 'saving' &&
                    'Salvando arquivo no formato escolhido.'}
                  {(phase === 'idle' || phase === 'error') &&
                    'Pronto para uma nova gravação.'}
                </p>

                <button
                  onClick={() => {
                    if (isRecording) {
                      stopRecording();
                      return;
                    }
                    void startRecording();
                  }}
                  className={`mt-6 flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-semibold transition-all ${
                    isRecording
                      ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white hover:from-rose-700 hover:to-rose-800'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                  }`}
                >
                  <Video className="h-5 w-5" />
                  {isRecording ? 'Parar gravação' : 'Iniciar gravação'}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
};

export default ControlPanel;
