import { app, BrowserWindow, ipcMain, screen, desktopCapturer, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

const DIST_PATH = process.env.DIST!;

// Suppress DevTools autofill protocol errors (harmless warnings)
process.on('uncaughtException', (error) => {
    if (error.message?.includes('Autofill') || error.message?.includes('wasn\'t found')) {
        // Silently ignore DevTools autofill errors
        return;
    }
    // Re-throw other errors
    throw error;
});

// Suppress console errors for DevTools protocol issues and harmless warnings
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
console.error = (...args: any[]) => {
    const message = args.join(' ');
    // Filter out DevTools autofill errors
    if (message.includes('Autofill.enable') || 
        message.includes('Autofill.setAddresses') ||
        (message.includes("wasn't found") && message.includes('Autofill'))) {
        return; // Suppress these errors
    }
    // Filter out harmless sysctlbyname warnings
    if (message.includes('sysctlbyname') && message.includes('kern.hv_vmm_present')) {
        return; // Suppress sysctlbyname warnings
    }
    originalConsoleError.apply(console, args);
};
console.warn = (...args: any[]) => {
    const message = args.join(' ');
    // Filter out NSCameraUseContinuityCameraDeviceType warning
    if (message.includes('NSCameraUseContinuityCameraDeviceType') || 
        message.includes('Info.plist')) {
        return; // Suppress camera warning (handled in production builds)
    }
    originalConsoleWarn.apply(console, args);
};

let controlWindow: BrowserWindow | null;
let cameraWindow: BrowserWindow | null;
let teleprompterWindow: BrowserWindow | null;
let timerWindow: BrowserWindow | null;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createControlWindow() {
    const preloadPath = path.join(__dirname, 'preload.js');
    console.log('Preload path for control window:', preloadPath);
    console.log('Preload file exists:', fs.existsSync(preloadPath));
    
    const iconPath = path.join(process.env.VITE_PUBLIC || DIST_PATH, 'icon.png');
    
    controlWindow = new BrowserWindow({
        width: 800,
        height: 600,
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        title: 'Studio Recorder',
        show: true, // Ensure window is shown
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Open DevTools for debugging
    controlWindow.webContents.openDevTools();

    if (VITE_DEV_SERVER_URL) {
        controlWindow.loadURL(VITE_DEV_SERVER_URL as string);
    } else {
        controlWindow.loadFile(path.join(DIST_PATH, 'index.html'));
    }

    // Hide control window from screen capture - must be called after load
    // Note: On macOS, this may affect dock icon visibility in some cases
    controlWindow.webContents.once('did-finish-load', () => {
        if (controlWindow) {
            controlWindow.setContentProtection(true);
            // Force show window after protection is set (macOS workaround)
            if (process.platform === 'darwin') {
                controlWindow.show();
                app.dock?.show();
            }
        }
    });
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
        skipTaskbar: false, // Make sure it appears in task switcher
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    
    // Make sure camera window is visible on all workspaces AND in screen recordings
    cameraWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Camera window is NOT protected - it WILL appear in screen recordings
    // This is intentional - the camera should be captured as an overlay

    if (VITE_DEV_SERVER_URL) {
        cameraWindow.loadURL(`${VITE_DEV_SERVER_URL}#/camera`);
    } else {
        cameraWindow.loadFile(path.join(DIST_PATH, 'index.html'), { hash: 'camera' });
    }
}

function createTeleprompterWindow() {
    // Clean up old window if exists
    if (teleprompterWindow && !teleprompterWindow.isDestroyed()) {
        teleprompterWindow.destroy();
    }

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

    // Handle window close
    teleprompterWindow.on('closed', () => {
        teleprompterWindow = null;
    });

    if (VITE_DEV_SERVER_URL) {
        teleprompterWindow.loadURL(`${VITE_DEV_SERVER_URL}#/teleprompter`);
    } else {
        teleprompterWindow.loadFile(path.join(DIST_PATH, 'index.html'), { hash: 'teleprompter' });
    }
}

function createTimerWindow() {
    // Clean up old window if exists
    if (timerWindow && !timerWindow.isDestroyed()) {
        timerWindow.destroy();
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width } = primaryDisplay.workAreaSize;

    timerWindow = new BrowserWindow({
        width: 200,
        height: 60,
        x: Math.floor((width - 200) / 2), // Center horizontally
        y: primaryDisplay.workAreaSize.height - 70, // 70px from bottom
        frame: false,
        transparent: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        hasShadow: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // CRITICAL: Hide timer from screen capture
    timerWindow.setContentProtection(true);

    // Handle window close
    timerWindow.on('closed', () => {
        timerWindow = null;
    });

    if (VITE_DEV_SERVER_URL) {
        timerWindow.loadURL(`${VITE_DEV_SERVER_URL}#/timer`);
    } else {
        timerWindow.loadFile(path.join(DIST_PATH, 'index.html'), { hash: 'timer' });
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
    // For macOS Continuity Camera support (warning suppression)
    // Note: This warning will still appear in development mode because
    // Info.plist modification requires app rebuild. In production builds,
    // the electron-builder config in package.json will handle this.
    if (process.platform === 'darwin' && !app.isPackaged) {
        // In development, we can't easily modify Info.plist, but the warning is harmless
        // The app will still work; the warning just means Continuity Camera features may be limited
    }
    
    createControlWindow();
    createCameraWindow();
    // Teleprompter will be created on demand via button click

    // IPC Handlers
    ipcMain.handle('get-sources', async () => {
        const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
        
        // Filter out control window and teleprompter window from sources by name
        const filteredSources = sources
            .filter((source: any) => {
                // Exclude control window and teleprompter window by name
                const name = source.name.toLowerCase();
                const isControlWindow = name.includes('screen-recorder-electron') && 
                                      !name.includes('camera') &&
                                      !name.includes('teleprompter');
                const isTeleprompterWindow = name.includes('teleprompter');
                return !isControlWindow && !isTeleprompterWindow;
            })
            .map((source: any) => ({
                id: source.id,
                name: source.name,
                thumbnail: source.thumbnail.toDataURL(),
            }));
        
        return filteredSources;
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
            } else if (shape === 'square') {
                cameraWindow.setSize(300, 300);
            } else if (shape === 'rounded') {
                cameraWindow.setSize(300, 300);
            }
        } else {
            console.error('Camera window is null');
        }
    });

    ipcMain.on('set-teleprompter-text', (_, text) => {
        console.log('Received set-teleprompter-text:', text.substring(0, 50) + '...');
        if (teleprompterWindow) {
            console.log('Sending teleprompter-text-changed to teleprompter window');
            teleprompterWindow.webContents.send('teleprompter-text-changed', text);
        } else {
            console.error('Teleprompter window is null');
        }
    });

    ipcMain.on('set-camera-size', (_, size) => {
        console.log('Received set-camera-size:', size);
        if (cameraWindow) {
            let width = 300;
            let height = 300;
            switch (size) {
                case 'small': width = 200; height = 200; break;
                case 'medium': width = 300; height = 300; break;
                case 'large': width = 450; height = 450; break;
            }
            console.log(`Resizing camera window to ${width}x${height}`);
            cameraWindow.setSize(width, height);
        } else {
            console.error('Camera window is null');
        }
    });

    ipcMain.handle('save-recording', async (_, buffer, extension = 'webm', format?: string) => {
        console.log(`save-recording called with extension: ${extension}, format: ${format}`);
        
        // Ensure extension matches the chosen format
        // If format is mp4, force extension to mp4
        if (format === 'mp4') {
            extension = 'mp4';
        } else if (format && format.startsWith('webm')) {
            extension = 'webm';
        }
        
        // Define file filters based on extension
        const filters: { name: string; extensions: string[] }[] = [];
        
        if (extension === 'mp4') {
            filters.push({ name: 'MP4 Video', extensions: ['mp4'] });
        } else {
            filters.push({ name: 'WebM Video', extensions: ['webm'] });
        }
        
        // Add all video formats as options
        filters.push(
            { name: 'All Video Formats', extensions: ['webm', 'mp4', 'mov', 'avi'] }
        );

        const { filePath, canceled } = await dialog.showSaveDialog({
            buttonLabel: 'Salvar vídeo',
            defaultPath: `recording-${Date.now()}.${extension}`,
            filters: filters
        });

        if (filePath && !canceled) {
            // Ensure the file path has the correct extension based on chosen format
            let finalFilePath = filePath;
            const pathExt = path.extname(filePath).toLowerCase();
            
            if (extension === 'mp4' && pathExt !== '.mp4') {
                // User might have changed extension, but we need MP4
                finalFilePath = filePath.replace(/\.[^.]+$/, '.mp4');
            } else if (extension === 'webm' && pathExt !== '.webm') {
                // User might have changed extension, but we need WebM
                finalFilePath = filePath.replace(/\.[^.]+$/, '.webm');
            }
            
            console.log(`Saving to: ${finalFilePath} with extension: ${extension}`);
            
            try {
                // If extension is mp4, we need to convert from WebM
                // (MediaRecorder always records in WebM format)
                if (extension === 'mp4') {
                    // Create temporary WebM file
                    const tempWebmPath = path.join(app.getPath('temp'), `temp-recording-${Date.now()}.webm`);
                    await writeFile(tempWebmPath, Buffer.from(buffer));
                    
                    console.log('Converting WebM to MP4...');
                    console.log('Temp file:', tempWebmPath);
                    console.log('Output file:', finalFilePath);
                    
                    // Convert WebM to MP4 using ffmpeg
                    await new Promise<void>((resolve, reject) => {
                        ffmpeg(tempWebmPath)
                            .outputOptions([
                                '-c:v libx264',
                                '-preset fast',
                                '-crf 23',
                                '-c:a aac',
                                '-b:a 128k',
                                '-movflags +faststart' // For web playback
                            ])
                            .output(finalFilePath)
                            .on('end', () => {
                                console.log('Conversion completed successfully');
                                // Delete temporary file
                                unlink(tempWebmPath).catch(err => {
                                    console.warn('Failed to delete temp file:', err);
                                });
                                resolve();
                            })
                            .on('error', (err: Error) => {
                                console.error('FFmpeg conversion error:', err);
                                // Delete temporary file even on error
                                unlink(tempWebmPath).catch(() => {});
                                reject(err);
                            })
                            .on('progress', (progress: { percent?: number }) => {
                                if (progress.percent) {
                                    console.log(`Conversion progress: ${Math.round(progress.percent)}%`);
                                }
                            })
                            .run();
                    });
                    
                    console.log('Video converted and saved successfully!');
                } else {
                    // Save WebM directly
                    await writeFile(finalFilePath, Buffer.from(buffer));
                    console.log(`Video saved as ${extension} successfully!`);
                }
                return true;
            } catch (error) {
                console.error('Error saving video:', error);
                return false;
            }
        }
        return false;
    });

    ipcMain.on('close-teleprompter', () => {
        console.log('Received close-teleprompter IPC message');
        if (teleprompterWindow) {
            console.log('Teleprompter window exists, closing it...');
            teleprompterWindow.close();
            teleprompterWindow = null;
            console.log('Teleprompter window closed');
        } else {
            console.log('Teleprompter window is null or already closed');
        }
    });

    ipcMain.on('toggle-teleprompter', () => {
        console.log('Toggling teleprompter window');
        if (teleprompterWindow && !teleprompterWindow.isDestroyed()) {
            if (teleprompterWindow.isVisible()) {
                teleprompterWindow.hide();
            } else {
                teleprompterWindow.show();
            }
        } else {
            // If window was destroyed, recreate it
            console.log('Recreating teleprompter window');
            createTeleprompterWindow();
        }
    });

    ipcMain.on('open-teleprompter', () => {
        console.log('Received open-teleprompter IPC message');
        if (teleprompterWindow && !teleprompterWindow.isDestroyed()) {
            // Window exists, just show it
            teleprompterWindow.show();
            teleprompterWindow.focus();
        } else {
            // Window doesn't exist, create it
            console.log('Creating teleprompter window');
            createTeleprompterWindow();
        }
    });

    ipcMain.on('hide-control-window', () => {
        console.log('Hiding control window');
        if (controlWindow && !controlWindow.isDestroyed()) {
            controlWindow.hide();
        }
    });

    ipcMain.on('show-control-window', () => {
        console.log('Showing control window');
        if (controlWindow && !controlWindow.isDestroyed()) {
            controlWindow.show();
            controlWindow.focus();
        }
    });

    ipcMain.on('hide-camera-window', () => {
        console.log('Hiding camera window');
        if (cameraWindow && !cameraWindow.isDestroyed()) {
            cameraWindow.hide();
        }
    });

    ipcMain.on('show-camera-window', () => {
        console.log('Showing camera window');
        if (cameraWindow && !cameraWindow.isDestroyed()) {
            cameraWindow.show();
        }
    });

    ipcMain.on('show-timer', () => {
        console.log('Showing recording timer');
        if (timerWindow && !timerWindow.isDestroyed()) {
            timerWindow.show();
        } else {
            createTimerWindow();
        }
    });

    ipcMain.on('hide-timer', () => {
        console.log('Hiding recording timer');
        if (timerWindow && !timerWindow.isDestroyed()) {
            timerWindow.close();
            timerWindow = null;
        }
    });
});
