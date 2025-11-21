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
    saveRecording: (buffer: ArrayBuffer, extension?: string, format?: string) => ipcRenderer.invoke('save-recording', buffer, extension, format),
    setCameraSize: (size: string) => ipcRenderer.send('set-camera-size', size),
    closeTeleprompter: () => ipcRenderer.send('close-teleprompter'),
    toggleTeleprompter: () => ipcRenderer.send('toggle-teleprompter'),
    openTeleprompter: () => ipcRenderer.send('open-teleprompter'),
    hideControlWindow: () => ipcRenderer.send('hide-control-window'),
    showControlWindow: () => ipcRenderer.send('show-control-window'),
    hideCameraWindow: () => ipcRenderer.send('hide-camera-window'),
    showCameraWindow: () => ipcRenderer.send('show-camera-window'),
    showTimer: () => ipcRenderer.send('show-timer'),
    hideTimer: () => ipcRenderer.send('hide-timer'),
});
