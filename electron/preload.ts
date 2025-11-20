import { contextBridge, ipcRenderer } from 'electron';

// Wrapper functions to handle IPC communication
const handleCameraShapeChange = (callback: (shape: string) => void) => {
    const handler = (_: any, shape: string) => callback(shape);
    ipcRenderer.on('camera-shape-changed', handler);
    // Return cleanup function (though in practice, listeners persist for window lifetime)
    return () => ipcRenderer.removeListener('camera-shape-changed', handler);
};

const handleTeleprompterTextChange = (callback: (text: string) => void) => {
    const handler = (_: any, text: string) => callback(text);
    ipcRenderer.on('teleprompter-text-changed', handler);
    // Return cleanup function (though in practice, listeners persist for window lifetime)
    return () => ipcRenderer.removeListener('teleprompter-text-changed', handler);
};

contextBridge.exposeInMainWorld('electronAPI', {
    getSources: () => ipcRenderer.invoke('get-sources'),
    setCameraShape: (shape: string) => ipcRenderer.send('set-camera-shape', shape),
    onCameraShapeChange: handleCameraShapeChange,
    setTeleprompterText: (text: string) => ipcRenderer.send('set-teleprompter-text', text),
    onTeleprompterTextChange: handleTeleprompterTextChange,
    saveRecording: (buffer: ArrayBuffer) => ipcRenderer.invoke('save-recording', buffer),
    setCameraSize: (size: string) => ipcRenderer.send('set-camera-size', size),
});
