import type { IpcRenderer, IpcRendererEvent } from 'electron';
import {
  IPC_CHANNELS,
  type CameraShape,
  type CameraSize,
  type CleanupFn,
  type ElectronAPI,
  type SaveRecordingRequest,
} from './ipc-contract';

type EventCallback<T> = (value: T) => void;

const subscribe = <T>(
  ipc: Pick<IpcRenderer, 'on' | 'removeListener'>,
  channel: string,
  callback: EventCallback<T>
): CleanupFn => {
  const handler = (_event: IpcRendererEvent, value: T) => callback(value);
  ipc.on(channel, handler);
  return () => ipc.removeListener(channel, handler);
};

const subscribeVoid = (
  ipc: Pick<IpcRenderer, 'on' | 'removeListener'>,
  channel: string,
  callback: () => void
): CleanupFn => {
  const handler = () => callback();
  ipc.on(channel, handler);
  return () => ipc.removeListener(channel, handler);
};

export const createElectronApi = (
  ipc: Pick<IpcRenderer, 'invoke' | 'send' | 'on' | 'removeListener'>
): ElectronAPI => ({
  getSources: () => ipc.invoke(IPC_CHANNELS.getSources),
  setCameraShape: (shape: CameraShape) => ipc.send(IPC_CHANNELS.setCameraShape, shape),
  onCameraShapeChange: (callback) => subscribe(ipc, IPC_CHANNELS.cameraShapeChanged, callback),
  setTeleprompterText: (text) => ipc.send(IPC_CHANNELS.setTeleprompterText, text),
  onTeleprompterTextChange: (callback) => subscribe(ipc, IPC_CHANNELS.teleprompterTextChanged, callback),
  getTeleprompterText: () => ipc.invoke(IPC_CHANNELS.getTeleprompterText),
  openTeleprompterControl: () => ipc.send(IPC_CHANNELS.openTeleprompterControl),
  saveRecording: (request: SaveRecordingRequest) => ipc.invoke(IPC_CHANNELS.saveRecording, request),
  setCameraSize: (size: CameraSize) => ipc.send(IPC_CHANNELS.setCameraSize, size),
  closeTeleprompter: () => ipc.send(IPC_CHANNELS.closeTeleprompter),
  toggleTeleprompter: () => ipc.send(IPC_CHANNELS.toggleTeleprompter),
  openTeleprompter: () => ipc.send(IPC_CHANNELS.openTeleprompter),
  hideControlWindow: () => ipc.send(IPC_CHANNELS.hideControlWindow),
  showControlWindow: () => ipc.send(IPC_CHANNELS.showControlWindow),
  hideCameraWindow: () => ipc.send(IPC_CHANNELS.hideCameraWindow),
  showCameraWindow: () => ipc.send(IPC_CHANNELS.showCameraWindow),
  showTimer: () => ipc.send(IPC_CHANNELS.showTimer),
  hideTimer: () => ipc.send(IPC_CHANNELS.hideTimer),
  stopRecording: () => ipc.send(IPC_CHANNELS.stopRecording),
  onStopRecordingTrigger: (callback) => subscribeVoid(ipc, IPC_CHANNELS.stopRecordingTrigger, callback),
  startRecording: () => ipc.send(IPC_CHANNELS.startRecording),
  onStartRecordingTrigger: (callback) => subscribeVoid(ipc, IPC_CHANNELS.startRecordingTrigger, callback),
  broadcastRecordingState: (isRecording: boolean) => ipc.send(IPC_CHANNELS.broadcastRecordingState, isRecording),
  onRecordingStateChange: (callback) => subscribe(ipc, IPC_CHANNELS.recordingStateChanged, callback),
  getRecordingState: () => ipc.invoke(IPC_CHANNELS.getRecordingState),
  showMainPanel: () => ipc.send(IPC_CHANNELS.showMainPanel),
  showMiniPanel: () => ipc.send(IPC_CHANNELS.showMiniPanel),
});
