import { contextBridge, ipcRenderer } from 'electron';
import { createElectronApi } from './createElectronApi.js';

contextBridge.exposeInMainWorld('electronAPI', createElectronApi(ipcRenderer));
