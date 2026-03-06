import { contextBridge, ipcRenderer } from 'electron';
import { createElectronApi } from './createElectronApi';

contextBridge.exposeInMainWorld('electronAPI', createElectronApi(ipcRenderer));
