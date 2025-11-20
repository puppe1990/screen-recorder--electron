"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => electron_1.ipcRenderer.invoke('get-sources'),
    setCameraShape: (shape) => electron_1.ipcRenderer.send('set-camera-shape', shape),
    onCameraShapeChange: (callback) => electron_1.ipcRenderer.on('camera-shape-changed', (_, shape) => callback(shape)),
    setTeleprompterText: (text) => electron_1.ipcRenderer.send('set-teleprompter-text', text),
    onTeleprompterTextChange: (callback) => electron_1.ipcRenderer.on('teleprompter-text-changed', (_, text) => callback(text)),
    saveRecording: (buffer) => electron_1.ipcRenderer.invoke('save-recording', buffer),
    setCameraSize: (size) => electron_1.ipcRenderer.send('set-camera-size', size),
});
//# sourceMappingURL=preload.js.map