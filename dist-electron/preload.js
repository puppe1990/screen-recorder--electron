import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    setCameraShape: (shape) => ipcRenderer.send('set-camera-shape', shape),
    onCameraShapeChange: (callback) => ipcRenderer.on('camera-shape-changed', (_, shape) => callback(shape)),
    setTeleprompterText: (text) => ipcRenderer.send('set-teleprompter-text', text),
    onTeleprompterTextChange: (callback) => ipcRenderer.on('teleprompter-text-changed', (_, text) => callback(text)),
    saveRecording: (buffer) => ipcRenderer.invoke('save-recording', buffer),
    setCameraSize: (size) => ipcRenderer.send('set-camera-size', size),
});
//# sourceMappingURL=preload.js.map