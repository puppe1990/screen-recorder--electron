import { app, BrowserWindow, ipcMain, screen, desktopCapturer, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');
const DIST_PATH = process.env.DIST;
let controlWindow;
let cameraWindow;
let teleprompterWindow;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
function createControlWindow() {
    controlWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (VITE_DEV_SERVER_URL) {
        controlWindow.loadURL(VITE_DEV_SERVER_URL);
    }
    else {
        controlWindow.loadFile(path.join(DIST_PATH, 'index.html'));
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
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (VITE_DEV_SERVER_URL) {
        cameraWindow.loadURL(`${VITE_DEV_SERVER_URL}#/camera`);
    }
    else {
        cameraWindow.loadFile(path.join(DIST_PATH, 'index.html'), { hash: 'camera' });
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
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // CRITICAL: Hide from screen capture
    teleprompterWindow.setContentProtection(true);
    if (VITE_DEV_SERVER_URL) {
        teleprompterWindow.loadURL(`${VITE_DEV_SERVER_URL}#/teleprompter`);
    }
    else {
        teleprompterWindow.loadFile(path.join(DIST_PATH, 'index.html'), { hash: 'teleprompter' });
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
        const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
        return sources.map((source) => ({
            id: source.id,
            name: source.name,
            thumbnail: source.thumbnail.toDataURL(),
        }));
    });
    ipcMain.on('set-camera-shape', (_, shape) => {
        console.log('Received set-camera-shape:', shape);
        if (cameraWindow) {
            console.log('Sending camera-shape-changed to camera window');
            cameraWindow.webContents.send('camera-shape-changed', shape);
            // Optional: Resize window if needed based on shape
            if (shape === 'circle') {
                cameraWindow.setSize(300, 300);
                // Make it round via setShape (complex) or just rely on CSS transparency
            }
            else if (shape === 'square') {
                cameraWindow.setSize(300, 300);
            }
            else if (shape === 'rounded') {
                cameraWindow.setSize(300, 300);
            }
        }
        else {
            console.error('Camera window is null');
        }
    });
    ipcMain.on('set-teleprompter-text', (_, text) => {
        console.log('Received set-teleprompter-text:', text.substring(0, 50) + '...');
        if (teleprompterWindow) {
            console.log('Sending teleprompter-text-changed to teleprompter window');
            teleprompterWindow.webContents.send('teleprompter-text-changed', text);
        }
        else {
            console.error('Teleprompter window is null');
        }
    });
    ipcMain.on('set-camera-size', (_, size) => {
        console.log('Received set-camera-size:', size);
        if (cameraWindow) {
            let width = 300;
            let height = 300;
            switch (size) {
                case 'small':
                    width = 200;
                    height = 200;
                    break;
                case 'medium':
                    width = 300;
                    height = 300;
                    break;
                case 'large':
                    width = 450;
                    height = 450;
                    break;
            }
            console.log(`Resizing camera window to ${width}x${height}`);
            cameraWindow.setSize(width, height);
        }
        else {
            console.error('Camera window is null');
        }
    });
    ipcMain.handle('save-recording', async (_, buffer) => {
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
//# sourceMappingURL=main.js.map