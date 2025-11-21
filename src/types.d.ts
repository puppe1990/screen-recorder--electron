export interface IElectronAPI {
    getSources: () => Promise<{ id: string; name: string; thumbnail: string }[]>;
    setCameraShape: (shape: string) => void;
    onCameraShapeChange: (callback: (shape: string) => void) => void;
    setTeleprompterText: (text: string) => void;
    onTeleprompterTextChange: (callback: (text: string) => void) => () => void;
    getTeleprompterText: () => Promise<string>;
    saveRecording: (buffer: ArrayBuffer, extension?: string, format?: string) => Promise<boolean>;
    setCameraSize: (size: string) => void;
    closeTeleprompter: () => void;
    toggleTeleprompter: () => void;
    openTeleprompter: () => void;
    hideControlWindow: () => void;
    showControlWindow: () => void;
    hideCameraWindow: () => void;
    showCameraWindow: () => void;
    showTimer: () => void;
    hideTimer: () => void;
    stopRecording: () => void;
    onStopRecordingTrigger: (callback: () => void) => () => void;
    startRecording: () => void;
    onStartRecordingTrigger: (callback: () => void) => () => void;
    broadcastRecordingState: (isRecording: boolean) => void;
    onRecordingStateChange: (callback: (isRecording: boolean) => void) => () => void;
    getRecordingState: () => Promise<boolean>;
    showMainPanel: () => void;
    showMiniPanel: () => void;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }
}
