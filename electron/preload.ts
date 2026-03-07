import { contextBridge, ipcRenderer } from 'electron';

type CleanupFn = () => void;
type CameraShape = 'circle' | 'rounded' | 'square';
type CameraSize = 'small' | 'medium' | 'large';
type VideoFormat = 'webm-vp9' | 'webm-vp8' | 'mp4' | 'webm';

interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
}

interface SaveRecordingRequest {
  buffer: ArrayBuffer;
  format: VideoFormat;
}

interface SaveRecordingSuccess {
  ok: true;
  filePath: string;
}

interface SaveRecordingFailure {
  ok: false;
  code: 'CANCELLED' | 'WRITE_FAILED' | 'CONVERSION_FAILED';
  message: string;
}

type SaveRecordingResult = SaveRecordingSuccess | SaveRecordingFailure;

interface ElectronAPI {
  getSources: () => Promise<DesktopSource[]>;
  setCameraShape: (shape: CameraShape) => void;
  onCameraShapeChange: (callback: (shape: CameraShape) => void) => CleanupFn;
  onCameraStatusChange: (callback: (message: string | null) => void) => CleanupFn;
  setTeleprompterText: (text: string) => void;
  onTeleprompterTextChange: (callback: (text: string) => void) => CleanupFn;
  getTeleprompterText: () => Promise<string>;
  openTeleprompterControl: () => void;
  saveRecording: (request: SaveRecordingRequest) => Promise<SaveRecordingResult>;
  setCameraSize: (size: CameraSize) => void;
  closeTeleprompter: () => void;
  toggleTeleprompter: () => void;
  openTeleprompter: () => void;
  hideControlWindow: () => void;
  showControlWindow: () => void;
  hideCameraWindow: () => void;
  showCameraWindow: () => void;
  showTimer: () => void;
  hideTimer: () => void;
  stopRecording: () => void;
  onStopRecordingTrigger: (callback: () => void) => CleanupFn;
  startRecording: () => void;
  onStartRecordingTrigger: (callback: () => void) => CleanupFn;
  broadcastRecordingState: (isRecording: boolean) => void;
  onRecordingStateChange: (callback: (isRecording: boolean) => void) => CleanupFn;
  getRecordingState: () => Promise<boolean>;
  showMainPanel: () => void;
  showMiniPanel: () => void;
}

const IPC_CHANNELS = {
  getSources: 'get-sources',
  getRecordingState: 'get-recording-state',
  getTeleprompterText: 'get-teleprompter-text',
  setCameraShape: 'set-camera-shape',
  cameraShapeChanged: 'camera-shape-changed',
  cameraStatusChanged: 'camera-status-changed',
  setCameraSize: 'set-camera-size',
  setTeleprompterText: 'set-teleprompter-text',
  teleprompterTextChanged: 'teleprompter-text-changed',
  openTeleprompterControl: 'open-teleprompter-control',
  openTeleprompter: 'open-teleprompter',
  closeTeleprompter: 'close-teleprompter',
  toggleTeleprompter: 'toggle-teleprompter',
  saveRecording: 'save-recording',
  hideControlWindow: 'hide-control-window',
  showControlWindow: 'show-control-window',
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
  showMainPanel: 'show-main-panel',
  showMiniPanel: 'show-mini-panel',
} as const;

const subscribe = <T>(channel: string, callback: (value: T) => void) => {
  const handler = (_event: unknown, value: T) => callback(value);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

const subscribeVoid = (channel: string, callback: () => void) => {
  const handler = () => callback();
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

const electronAPI: ElectronAPI = {
  getSources: () => ipcRenderer.invoke(IPC_CHANNELS.getSources),
  setCameraShape: (shape: CameraShape) => ipcRenderer.send(IPC_CHANNELS.setCameraShape, shape),
  onCameraShapeChange: (callback) => subscribe(IPC_CHANNELS.cameraShapeChanged, callback),
  onCameraStatusChange: (callback) => subscribe(IPC_CHANNELS.cameraStatusChanged, callback),
  setTeleprompterText: (text: string) => ipcRenderer.send(IPC_CHANNELS.setTeleprompterText, text),
  onTeleprompterTextChange: (callback) => subscribe(IPC_CHANNELS.teleprompterTextChanged, callback),
  getTeleprompterText: () => ipcRenderer.invoke(IPC_CHANNELS.getTeleprompterText),
  openTeleprompterControl: () => ipcRenderer.send(IPC_CHANNELS.openTeleprompterControl),
  saveRecording: (request: SaveRecordingRequest) => ipcRenderer.invoke(IPC_CHANNELS.saveRecording, request),
  setCameraSize: (size: CameraSize) => ipcRenderer.send(IPC_CHANNELS.setCameraSize, size),
  closeTeleprompter: () => ipcRenderer.send(IPC_CHANNELS.closeTeleprompter),
  toggleTeleprompter: () => ipcRenderer.send(IPC_CHANNELS.toggleTeleprompter),
  openTeleprompter: () => ipcRenderer.send(IPC_CHANNELS.openTeleprompter),
  hideControlWindow: () => ipcRenderer.send(IPC_CHANNELS.hideControlWindow),
  showControlWindow: () => ipcRenderer.send(IPC_CHANNELS.showControlWindow),
  hideCameraWindow: () => ipcRenderer.send(IPC_CHANNELS.hideCameraWindow),
  showCameraWindow: () => ipcRenderer.send(IPC_CHANNELS.showCameraWindow),
  showTimer: () => ipcRenderer.send(IPC_CHANNELS.showTimer),
  hideTimer: () => ipcRenderer.send(IPC_CHANNELS.hideTimer),
  stopRecording: () => ipcRenderer.send(IPC_CHANNELS.stopRecording),
  onStopRecordingTrigger: (callback) => subscribeVoid(IPC_CHANNELS.stopRecordingTrigger, callback),
  startRecording: () => ipcRenderer.send(IPC_CHANNELS.startRecording),
  onStartRecordingTrigger: (callback) => subscribeVoid(IPC_CHANNELS.startRecordingTrigger, callback),
  broadcastRecordingState: (isRecording: boolean) => ipcRenderer.send(IPC_CHANNELS.broadcastRecordingState, isRecording),
  onRecordingStateChange: (callback) => subscribe(IPC_CHANNELS.recordingStateChanged, callback),
  getRecordingState: () => ipcRenderer.invoke(IPC_CHANNELS.getRecordingState),
  showMainPanel: () => ipcRenderer.send(IPC_CHANNELS.showMainPanel),
  showMiniPanel: () => ipcRenderer.send(IPC_CHANNELS.showMiniPanel),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
