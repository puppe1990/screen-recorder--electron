import { contextBridge, ipcRenderer } from 'electron';
// Wrapper functions to handle IPC communication
const handleCameraShapeChange = (callback) => {
    const handler = (_, shape) => callback(shape);
    ipcRenderer.on('camera-shape-changed', handler);
    // Return cleanup function (though in practice, listeners persist for window lifetime)
    return () => ipcRenderer.removeListener('camera-shape-changed', handler);
};
const handleTeleprompterTextChange = (callback) => {
    const handler = (_, text) => callback(text);
    ipcRenderer.on('teleprompter-text-changed', handler);
    // Return cleanup function (though in practice, listeners persist for window lifetime)
    return () => ipcRenderer.removeListener('teleprompter-text-changed', handler);
};
contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    setCameraShape: (shape) => ipcRenderer.send('set-camera-shape', shape),
    onCameraShapeChange: handleCameraShapeChange,
    setTeleprompterText: (text) => ipcRenderer.send('set-teleprompter-text', text),
    onTeleprompterTextChange: handleTeleprompterTextChange,
    saveRecording: (buffer) => ipcRenderer.invoke('save-recording', buffer),
    setCameraSize: (size) => ipcRenderer.send('set-camera-size', size),
    closeTeleprompter: () => ipcRenderer.send('close-teleprompter'),
    toggleTeleprompter: () => ipcRenderer.send('toggle-teleprompter'),
    openTeleprompter: () => ipcRenderer.send('open-teleprompter'),
});
//# sourceMappingURL=preload.js.map