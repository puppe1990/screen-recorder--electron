export const IPC_CHANNELS = {
  getSources: 'get-sources',
  getRecordingState: 'get-recording-state',
  getTeleprompterText: 'get-teleprompter-text',
  setCameraShape: 'set-camera-shape',
  cameraShapeChanged: 'camera-shape-changed',
  cameraStatusChanged: 'camera-status-changed',
  setCameraSize: 'set-camera-size',
  setTeleprompterText: 'set-teleprompter-text',
  teleprompterTextChanged: 'teleprompter-text-changed',
  openTeleprompter: 'open-teleprompter',
  closeTeleprompter: 'close-teleprompter',
  toggleTeleprompter: 'toggle-teleprompter',
  saveRecording: 'save-recording',
  hideCameraWindow: 'hide-camera-window',
  showCameraWindow: 'show-camera-window',
  showTimer: 'show-timer',
  hideTimer: 'hide-timer',
  stopRecording: 'stop-recording',
  stopRecordingTrigger: 'stop-recording-trigger',
  startRecording: 'start-recording',
  startRecordingTrigger: 'start-recording-trigger',
  broadcastRecordingState: 'broadcast-recording-state',
  recordingStateChanged: 'recording-state-changed',
  resizeMiniPanel: 'resize-mini-panel',
  teleprompterPlay: 'teleprompter-play',
  teleprompterPause: 'teleprompter-pause',
  teleprompterReset: 'teleprompter-reset',
  teleprompterSetSpeed: 'teleprompter-set-speed',
  teleprompterWindowOpened: 'teleprompter-window-opened',
  teleprompterWindowClosed: 'teleprompter-window-closed',
  teleprompterScrollDone: 'teleprompter-scroll-done',
} as const;

export type CleanupFn = () => void;

export type CameraShape = 'circle' | 'rounded' | 'square';
export type CameraSize = 'small' | 'medium' | 'large';
export type VideoFormat = 'webm-vp9' | 'webm-vp8' | 'mp4' | 'webm';

export interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
}

export interface SaveRecordingRequest {
  buffer: ArrayBuffer;
  format: VideoFormat;
}

export interface SaveRecordingSuccess {
  ok: true;
  filePath: string;
}

export interface SaveRecordingFailure {
  ok: false;
  code: 'CANCELLED' | 'WRITE_FAILED' | 'CONVERSION_FAILED';
  message: string;
}

export type SaveRecordingResult = SaveRecordingSuccess | SaveRecordingFailure;

export interface ElectronAPI {
  getSources: () => Promise<DesktopSource[]>;
  setCameraShape: (shape: CameraShape) => void;
  onCameraShapeChange: (callback: (shape: CameraShape) => void) => CleanupFn;
  onCameraStatusChange: (
    callback: (message: string | null) => void
  ) => CleanupFn;
  setTeleprompterText: (text: string) => void;
  onTeleprompterTextChange: (callback: (text: string) => void) => CleanupFn;
  getTeleprompterText: () => Promise<string>;
  saveRecording: (
    request: SaveRecordingRequest
  ) => Promise<SaveRecordingResult>;
  setCameraSize: (size: CameraSize) => void;
  closeTeleprompter: () => void;
  toggleTeleprompter: () => void;
  openTeleprompter: () => void;
  hideCameraWindow: () => void;
  showCameraWindow: () => void;
  showTimer: () => void;
  hideTimer: () => void;
  stopRecording: () => void;
  onStopRecordingTrigger: (callback: () => void) => CleanupFn;
  startRecording: () => void;
  onStartRecordingTrigger: (callback: () => void) => CleanupFn;
  broadcastRecordingState: (isRecording: boolean) => void;
  onRecordingStateChange: (
    callback: (isRecording: boolean) => void
  ) => CleanupFn;
  getRecordingState: () => Promise<boolean>;
  resizeMiniPanel: (expanded: boolean) => void;
  teleprompterPlay: () => void;
  teleprompterPause: () => void;
  teleprompterReset: () => void;
  teleprompterSetSpeed: (speed: number) => void;
  onTeleprompterWindowOpened: (callback: () => void) => CleanupFn;
  onTeleprompterWindowClosed: (callback: () => void) => CleanupFn;
  onTeleprompterPlay: (callback: () => void) => CleanupFn;
  onTeleprompterPause: (callback: () => void) => CleanupFn;
  onTeleprompterReset: (callback: () => void) => CleanupFn;
  onTeleprompterSetSpeed: (callback: (speed: number) => void) => CleanupFn;
  teleprompterScrollDone: () => void;
  onTeleprompterScrollDone: (callback: () => void) => CleanupFn;
}
