import type { ElectronAPI as IElectronAPI } from '../electron/ipc-contract';

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }
}

export type { IElectronAPI };
