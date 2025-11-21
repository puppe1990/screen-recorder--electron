export interface IElectronAPI {
    getSources: () => Promise<{ id: string; name: string; thumbnail: string }[]>;
    setCameraShape: (shape: string) => void;
    onCameraShapeChange: (callback: (shape: string) => void) => void;
    setTeleprompterText: (text: string) => void;
    onTeleprompterTextChange: (callback: (text: string) => void) => void;
    saveRecording: (buffer: ArrayBuffer, extension?: string) => Promise<boolean>;
    setCameraSize: (size: string) => void;
    closeTeleprompter: () => void;
    toggleTeleprompter: () => void;
    openTeleprompter: () => void;
    hideControlWindow: () => void;
    showControlWindow: () => void;
    hideCameraWindow: () => void;
    showCameraWindow: () => void;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }
}
