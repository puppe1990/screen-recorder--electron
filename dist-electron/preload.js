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
});
//# sourceMappingURL=preload.js.map