"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Wrapper functions to handle IPC communication
const handleCameraShapeChange = (callback) => {
    const handler = (_, shape) => callback(shape);
    electron_1.ipcRenderer.on('camera-shape-changed', handler);
    // Return cleanup function (though in practice, listeners persist for window lifetime)
    return () => electron_1.ipcRenderer.removeListener('camera-shape-changed', handler);
};
const handleTeleprompterTextChange = (callback) => {
    const handler = (_, text) => callback(text);
    electron_1.ipcRenderer.on('teleprompter-text-changed', handler);
    // Return cleanup function (though in practice, listeners persist for window lifetime)
    return () => electron_1.ipcRenderer.removeListener('teleprompter-text-changed', handler);
};
const handleStopRecordingTrigger = (callback) => {
    const handler = () => callback();
    electron_1.ipcRenderer.on('stop-recording-trigger', handler);
    return () => electron_1.ipcRenderer.removeListener('stop-recording-trigger', handler);
};
const handleStartRecordingTrigger = (callback) => {
    const handler = () => callback();
    electron_1.ipcRenderer.on('start-recording-trigger', handler);
    return () => electron_1.ipcRenderer.removeListener('start-recording-trigger', handler);
};
const handleRecordingStateChange = (callback) => {
    const handler = (_, isRecording) => callback(isRecording);
    electron_1.ipcRenderer.on('recording-state-changed', handler);
    return () => electron_1.ipcRenderer.removeListener('recording-state-changed', handler);
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => electron_1.ipcRenderer.invoke('get-sources'),
    setCameraShape: (shape) => electron_1.ipcRenderer.send('set-camera-shape', shape),
    onCameraShapeChange: handleCameraShapeChange,
    setTeleprompterText: (text) => electron_1.ipcRenderer.send('set-teleprompter-text', text),
    onTeleprompterTextChange: handleTeleprompterTextChange,
    saveRecording: (buffer, extension, format) => electron_1.ipcRenderer.invoke('save-recording', buffer, extension, format),
    setCameraSize: (size) => electron_1.ipcRenderer.send('set-camera-size', size),
    closeTeleprompter: () => electron_1.ipcRenderer.send('close-teleprompter'),
    toggleTeleprompter: () => electron_1.ipcRenderer.send('toggle-teleprompter'),
    openTeleprompter: () => electron_1.ipcRenderer.send('open-teleprompter'),
    hideControlWindow: () => electron_1.ipcRenderer.send('hide-control-window'),
    showControlWindow: () => electron_1.ipcRenderer.send('show-control-window'),
    hideCameraWindow: () => electron_1.ipcRenderer.send('hide-camera-window'),
    showCameraWindow: () => electron_1.ipcRenderer.send('show-camera-window'),
    showTimer: () => electron_1.ipcRenderer.send('show-timer'),
    hideTimer: () => electron_1.ipcRenderer.send('hide-timer'),
    stopRecording: () => electron_1.ipcRenderer.send('stop-recording'),
    onStopRecordingTrigger: handleStopRecordingTrigger,
    startRecording: () => electron_1.ipcRenderer.send('start-recording'),
    onStartRecordingTrigger: handleStartRecordingTrigger,
    broadcastRecordingState: (isRecording) => electron_1.ipcRenderer.send('broadcast-recording-state', isRecording),
    onRecordingStateChange: handleRecordingStateChange,
    getRecordingState: () => electron_1.ipcRenderer.invoke('get-recording-state'),
    showMainPanel: () => electron_1.ipcRenderer.send('show-main-panel'),
    showMiniPanel: () => electron_1.ipcRenderer.send('show-mini-panel'),
});
//# sourceMappingURL=preload.js.map