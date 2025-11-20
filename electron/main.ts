import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let controlWindow: BrowserWindow | null;
let cameraWindow: BrowserWindow | null;
let teleprompterWindow: BrowserWindow | null;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createControlWindow() {
    controlWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    if (VITE_DEV_SERVER_URL) {
        controlWindow.loadURL(VITE_DEV_SERVER_URL as string);
    } else {
        controlWindow.loadFile(path.join(process.env.DIST, 'index.html'));
    }
}

function createCameraWindow() {
    cameraWindow = new BrowserWindow({
        width: 300,
        height: 300,
        x: screen.getPrimaryDisplay().workAreaSize.width - 320,
        y: screen.getPrimaryDisplay().workAreaSize.height - 320,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        hasShadow: false,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    if (VITE_DEV_SERVER_URL) {
        cameraWindow.loadURL(`${VITE_DEV_SERVER_URL}#/camera`);
    } else {
        cameraWindow.loadFile(path.join(process.env.DIST, 'index.html'), { hash: 'camera' });
    }
}

function createTeleprompterWindow() {
    teleprompterWindow = new BrowserWindow({
        width: 600,
        height: 200,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // CRITICAL: Hide from screen capture
    teleprompterWindow.setContentProtection(true);

    if (VITE_DEV_SERVER_URL) {
        teleprompterWindow.loadURL(`${VITE_DEV_SERVER_URL}#/teleprompter`);
    } else {
        teleprompterWindow.loadFile(path.join(process.env.DIST, 'index.html'), { hash: 'teleprompter' });
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createControlWindow();
    }
});

app.whenReady().then(() => {
    createControlWindow();
    createCameraWindow();
    createTeleprompterWindow();

    // IPC Handlers
    ipcMain.handle('get-sources', async () => {
        const { desktopCapturer } = require('electron');
        const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
        return sources.map((source: any) => ({
            id: source.id,
            name: source.name,
            thumbnail: source.thumbnail.toDataURL(),
        }));
    });

    ipcMain.on('set-camera-shape', (_, shape) => {
        if (cameraWindow) {
            cameraWindow.webContents.send('camera-shape-changed', shape);
            // Optional: Resize window if needed based on shape
            if (shape === 'circle') {
                cameraWindow.setSize(300, 300);
                // Make it round via setShape (complex) or just rely on CSS transparency
            } else if (shape === 'square') {
                cameraWindow.setSize(300, 300);
            } else if (shape === 'rounded') {
                cameraWindow.setSize(300, 300);
            }
        }
    });

    ipcMain.on('set-teleprompter-text', (_, text) => {
        if (teleprompterWindow) {
            teleprompterWindow.webContents.send('teleprompter-text-changed', text);
        }
    });

    ipcMain.on('set-camera-size', (_, size) => {
        if (cameraWindow) {
            let width = 300;
            let height = 300;
            switch (size) {
                case 'small': width = 200; height = 200; break;
                case 'medium': width = 300; height = 300; break;
                case 'large': width = 450; height = 450; break;
            }
            cameraWindow.setSize(width, height);
        }
    });

    ipcMain.handle('save-recording', async (_, buffer) => {
        const { dialog } = require('electron');
        const fs = require('fs');
        const { filePath } = await dialog.showSaveDialog({
            buttonLabel: 'Save video',
            defaultPath: `recording-${Date.now()}.webm`
        });

        if (filePath) {
            fs.writeFile(filePath, Buffer.from(buffer), () => console.log('Video saved successfully!'));
            return true;
        }
        return false;
    });
});
