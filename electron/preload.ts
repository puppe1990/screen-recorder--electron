import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    setCameraShape: (shape: string) => ipcRenderer.send('set-camera-shape', shape),
    onCameraShapeChange: (callback: (shape: string) => void) => ipcRenderer.on('camera-shape-changed', (_, shape) => callback(shape)),
    setTeleprompterText: (text: string) => ipcRenderer.send('set-teleprompter-text', text),
    onTeleprompterTextChange: (callback: (text: string) => void) => ipcRenderer.on('teleprompter-text-changed', (_, text) => callback(text)),
    saveRecording: (buffer: ArrayBuffer) => ipcRenderer.invoke('save-recording', buffer),
    setCameraSize: (size: string) => ipcRenderer.send('set-camera-size', size),
});
