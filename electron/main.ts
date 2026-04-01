import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  desktopCapturer,
  dialog,
  ipcMain,
  nativeImage,
  screen,
  session,
  systemPreferences,
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { promisify } from 'util';
import {
  IPC_CHANNELS,
  type CameraShape,
  type CameraSize,
  type DesktopSource,
  type SaveRecordingFailure,
  type SaveRecordingRequest,
  type SaveRecordingResult,
  type VideoFormat,
} from './ipc-contract.js';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

const DIST_PATH = process.env.DIST!;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const preloadPath = path.join(__dirname, 'preload.js');

const DEFAULT_TELEPROMPTER_TEXT =
  'This is the teleprompter text. It will scroll automatically.\n\nYou can customize this text in the Control Panel.\n\nRemember to look at the camera!';
const INTERNAL_WINDOW_TITLES = ['studio recorder', 'teleprompter control'];

let cameraWindow: BrowserWindow | null = null;
let teleprompterWindow: BrowserWindow | null = null;
let miniPanelWindow: BrowserWindow | null = null;
let teleprompterControlWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentRecordingState = false;
let teleprompterText = DEFAULT_TELEPROMPTER_TEXT;
let cameraStatusMessage: string | null = null;
const MINI_PANEL_COLLAPSED = { width: 460, height: 148 };
const MINI_PANEL_EXPANDED = { width: 960, height: 620 };

const hasWindow = (window: BrowserWindow | null): window is BrowserWindow =>
  Boolean(window && !window.isDestroyed());

const loadRendererView = (window: BrowserWindow, hash: string) => {
  if (VITE_DEV_SERVER_URL) {
    void window.loadURL(`${VITE_DEV_SERVER_URL}#/${hash}`);
    return;
  }

  void window.loadFile(path.join(DIST_PATH, 'index.html'), { hash });
};

const showWindow = (window: BrowserWindow | null, focus = true) => {
  if (!hasWindow(window)) return;
  window.show();
  if (focus) {
    window.focus();
  }
};

const hideWindow = (window: BrowserWindow | null) => {
  if (hasWindow(window)) {
    window.hide();
  }
};

const sendToWindow = <T>(
  window: BrowserWindow | null,
  channel: string,
  payload?: T
) => {
  if (!hasWindow(window)) return;
  if (payload === undefined) {
    window.webContents.send(channel);
    return;
  }
  window.webContents.send(channel, payload);
};

const getMiniPanelBounds = (expanded: boolean) => {
  const display = screen.getPrimaryDisplay().workArea;
  const panelSize = expanded ? MINI_PANEL_EXPANDED : MINI_PANEL_COLLAPSED;
  const bottomMargin = 24;
  const x = Math.floor(display.x + (display.width - panelSize.width) / 2);
  const y = Math.max(
    display.y + 24,
    display.y + display.height - (panelSize.height + bottomMargin)
  );

  return {
    x,
    y,
    width: panelSize.width,
    height: panelSize.height,
  };
};

const resizeMiniPanelWindow = (expanded: boolean) => {
  if (!hasWindow(miniPanelWindow)) return;
  miniPanelWindow.setBounds(getMiniPanelBounds(expanded), true);
};

const getCameraBoundsForSize = (size: CameraSize) => {
  switch (size) {
    case 'small':
      return { width: 200, height: 200 };
    case 'large':
      return { width: 450, height: 450 };
    case 'medium':
    default:
      return { width: 300, height: 300 };
  }
};

const getOutputExtension = (format: VideoFormat) =>
  format === 'mp4' ? 'mp4' : 'webm';

const saveFailure = (
  code: SaveRecordingFailure['code'],
  message: string
): SaveRecordingFailure => ({
  ok: false,
  code,
  message,
});

const isInternalSource = (name: string) => {
  const normalizedName = name.toLowerCase();
  const matchesControlWindow = INTERNAL_WINDOW_TITLES.some((title) =>
    normalizedName.includes(title)
  );
  const matchesMiniPanel =
    normalizedName.includes('mini panel') ||
    normalizedName.includes('mini painel');
  const matchesTeleprompterWindow = normalizedName === 'teleprompter';

  return matchesControlWindow || matchesMiniPanel || matchesTeleprompterWindow;
};

const getTrayImage = () => {
  const iconPath = path.join(process.env.VITE_PUBLIC || DIST_PATH, 'icon.png');
  const image = nativeImage
    .createFromPath(iconPath)
    .resize({ width: 18, height: 18 });

  if (process.platform === 'darwin') {
    image.setTemplateImage(true);
  }

  return image;
};

const createTray = () => {
  if (tray) {
    return tray;
  }

  tray = new Tray(getTrayImage());
  tray.setToolTip('Studio Recorder');

  const refreshTrayMenu = () => {
    if (!tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Expandir painel',
        click: () => {
          createMiniPanelWindow();
          showWindow(miniPanelWindow);
          resizeMiniPanelWindow(true);
        },
      },
      {
        label: 'Mostrar mini painel',
        click: () => {
          createMiniPanelWindow();
          showWindow(miniPanelWindow);
          resizeMiniPanelWindow(false);
        },
      },
      {
        label:
          hasWindow(cameraWindow) && cameraWindow.isVisible()
            ? 'Ocultar camera'
            : 'Mostrar camera',
        click: () => {
          if (!hasWindow(cameraWindow)) {
            createCameraWindow();
            return;
          }

          if (cameraWindow.isVisible()) {
            hideWindow(cameraWindow);
            return;
          }

          showWindow(cameraWindow, false);
        },
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
  };

  tray.on('click', () => {
    createMiniPanelWindow();
    showWindow(miniPanelWindow);
    refreshTrayMenu();
  });

  refreshTrayMenu();
  return tray;
};

function createMiniPanelWindow() {
  if (hasWindow(miniPanelWindow)) {
    return miniPanelWindow;
  }

  const bounds = getMiniPanelBounds(false);

  miniPanelWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  miniPanelWindow.webContents.once('did-finish-load', () => {
    if (hasWindow(miniPanelWindow)) {
      miniPanelWindow.setContentProtection(true);
    }
  });

  loadRendererView(miniPanelWindow, 'minipanel');

  miniPanelWindow.on('closed', () => {
    miniPanelWindow = null;
  });

  return miniPanelWindow;
}

function createCameraWindow() {
  if (hasWindow(cameraWindow)) {
    return cameraWindow;
  }

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
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  cameraWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  loadRendererView(cameraWindow, 'camera');

  cameraWindow.webContents.once('did-finish-load', () => {
    sendToWindow(
      cameraWindow,
      IPC_CHANNELS.cameraStatusChanged,
      cameraStatusMessage
    );
  });

  cameraWindow.on('closed', () => {
    cameraWindow = null;
  });

  return cameraWindow;
}

const configureMediaPermissions = async () => {
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => {
      return permission === 'media';
    }
  );

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === 'media');
    }
  );

  if (process.platform === 'darwin') {
    const cameraGranted = await systemPreferences
      .askForMediaAccess('camera')
      .catch(() => false);
    await systemPreferences.askForMediaAccess('microphone').catch(() => false);

    if (!cameraGranted) {
      setCameraStatus(
        'Permita acesso à câmera nas configurações do macOS para exibir o overlay.'
      );
      return;
    }
  }

  setCameraStatus(null);
};

const setCameraStatus = (message: string | null) => {
  cameraStatusMessage = message;
  sendToWindow(cameraWindow, IPC_CHANNELS.cameraStatusChanged, message);
};

const getScreenCaptureErrorMessage = (error: unknown) => {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('screen');

    if (status !== 'granted') {
      return 'Permita a Gravação de Tela em Ajustes do Sistema > Privacidade e Segurança > Gravação de Tela para o app ou terminal que está executando o Electron, depois abra o app novamente.';
    }
  }

  return error instanceof Error
    ? error.message
    : 'Não foi possível listar as fontes de gravação.';
};

function createTeleprompterWindow() {
  if (hasWindow(teleprompterWindow)) {
    showWindow(teleprompterWindow);
    sendToWindow(
      teleprompterWindow,
      IPC_CHANNELS.teleprompterTextChanged,
      teleprompterText
    );
    return teleprompterWindow;
  }

  teleprompterWindow = new BrowserWindow({
    width: 900,
    height: 500,
    minWidth: 500,
    minHeight: 300,
    resizable: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  teleprompterWindow.setContentProtection(true);
  loadRendererView(teleprompterWindow, 'teleprompter');

  teleprompterWindow.webContents.once('did-finish-load', () => {
    sendToWindow(
      teleprompterWindow,
      IPC_CHANNELS.teleprompterTextChanged,
      teleprompterText
    );
  });

  teleprompterWindow.on('closed', () => {
    teleprompterWindow = null;
  });

  return teleprompterWindow;
}

function createTeleprompterControlWindow() {
  if (hasWindow(teleprompterControlWindow)) {
    showWindow(teleprompterControlWindow);
    return teleprompterControlWindow;
  }

  teleprompterControlWindow = new BrowserWindow({
    width: 700,
    height: 600,
    title: 'Teleprompter Control',
    show: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  teleprompterControlWindow.setContentProtection(true);
  loadRendererView(teleprompterControlWindow, 'teleprompter-control');

  teleprompterControlWindow.on('closed', () => {
    teleprompterControlWindow = null;
  });

  return teleprompterControlWindow;
}

const listCaptureSources = async (): Promise<DesktopSource[]> => {
  const excludedIds = new Set(
    [
      teleprompterWindow?.getMediaSourceId(),
      miniPanelWindow?.getMediaSourceId(),
      teleprompterControlWindow?.getMediaSourceId(),
    ].filter((value): value is string => Boolean(value))
  );

  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
    });

    return sources
      .filter((source) => {
        if (excludedIds.has(source.id)) {
          return false;
        }

        return !isInternalSource(source.name);
      })
      .sort((left, right) => {
        const leftIsScreen = left.id.startsWith('screen:');
        const rightIsScreen = right.id.startsWith('screen:');
        if (leftIsScreen === rightIsScreen) return 0;
        return leftIsScreen ? -1 : 1;
      })
      .map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      }));
  } catch (error) {
    console.error('Failed to list capture sources:', error);
    throw new Error(getScreenCaptureErrorMessage(error));
  }
};

const persistRecording = async (
  request: SaveRecordingRequest
): Promise<SaveRecordingResult> => {
  const extension = getOutputExtension(request.format);
  const filters =
    extension === 'mp4'
      ? [{ name: 'MP4 Video', extensions: ['mp4'] }]
      : [{ name: 'WebM Video', extensions: ['webm'] }];

  const { canceled, filePath } = await dialog.showSaveDialog({
    buttonLabel: 'Salvar vídeo',
    defaultPath: `recording-${Date.now()}.${extension}`,
    filters: [
      ...filters,
      { name: 'All Video Formats', extensions: ['webm', 'mp4', 'mov', 'avi'] },
    ],
  });

  if (canceled || !filePath) {
    return saveFailure('CANCELLED', 'Salvamento cancelado.');
  }

  const targetFilePath =
    path.extname(filePath).toLowerCase() === `.${extension}`
      ? filePath
      : `${filePath.replace(/\.[^.]+$/, '')}.${extension}`;

  try {
    if (extension === 'mp4') {
      const tempWebmPath = path.join(
        app.getPath('temp'),
        `temp-recording-${Date.now()}.webm`
      );
      await writeFile(tempWebmPath, Buffer.from(request.buffer));

      try {
        await new Promise<void>((resolve, reject) => {
          ffmpeg(tempWebmPath)
            .outputOptions([
              '-c:v libx264',
              '-preset fast',
              '-crf 23',
              '-c:a aac',
              '-b:a 128k',
              '-movflags +faststart',
            ])
            .output(targetFilePath)
            .on('end', () => resolve())
            .on('error', reject)
            .run();
        });
      } finally {
        void unlink(tempWebmPath).catch(() => undefined);
      }
    } else {
      await writeFile(targetFilePath, Buffer.from(request.buffer));
    }

    return {
      ok: true,
      filePath: targetFilePath,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Falha desconhecida ao salvar o vídeo.';
    return saveFailure(
      extension === 'mp4' ? 'CONVERSION_FAILED' : 'WRITE_FAILED',
      message
    );
  }
};

const registerIpcHandlers = () => {
  ipcMain.handle(IPC_CHANNELS.getSources, listCaptureSources);
  ipcMain.handle(
    IPC_CHANNELS.getRecordingState,
    async () => currentRecordingState
  );
  ipcMain.handle(
    IPC_CHANNELS.getTeleprompterText,
    async () => teleprompterText
  );
  ipcMain.handle(
    IPC_CHANNELS.saveRecording,
    async (_event, request: SaveRecordingRequest) => persistRecording(request)
  );

  ipcMain.on(IPC_CHANNELS.setCameraShape, (_event, shape: CameraShape) => {
    sendToWindow(cameraWindow, IPC_CHANNELS.cameraShapeChanged, shape);
  });

  ipcMain.on(IPC_CHANNELS.setCameraSize, (_event, size: CameraSize) => {
    if (!hasWindow(cameraWindow)) return;
    const { width, height } = getCameraBoundsForSize(size);
    cameraWindow.setSize(width, height);
  });

  ipcMain.on(IPC_CHANNELS.setTeleprompterText, (_event, text: string) => {
    teleprompterText = text;
    sendToWindow(
      teleprompterWindow,
      IPC_CHANNELS.teleprompterTextChanged,
      text
    );
    sendToWindow(
      teleprompterControlWindow,
      IPC_CHANNELS.teleprompterTextChanged,
      text
    );
  });

  ipcMain.on(IPC_CHANNELS.openTeleprompterControl, () => {
    createTeleprompterControlWindow();
  });

  ipcMain.on(IPC_CHANNELS.openTeleprompter, () => {
    createTeleprompterWindow();
  });

  ipcMain.on(IPC_CHANNELS.closeTeleprompter, () => {
    if (hasWindow(teleprompterWindow)) {
      teleprompterWindow.close();
    }
  });

  ipcMain.on(IPC_CHANNELS.toggleTeleprompter, () => {
    if (!hasWindow(teleprompterWindow)) {
      createTeleprompterWindow();
      return;
    }

    if (teleprompterWindow.isVisible()) {
      teleprompterWindow.hide();
      return;
    }

    showWindow(teleprompterWindow);
  });

  ipcMain.on(
    IPC_CHANNELS.broadcastRecordingState,
    (_event, isRecording: boolean) => {
      currentRecordingState = isRecording;
      sendToWindow(
        miniPanelWindow,
        IPC_CHANNELS.recordingStateChanged,
        isRecording
      );
    }
  );

  ipcMain.on(IPC_CHANNELS.hideControlWindow, () => undefined);
  ipcMain.on(IPC_CHANNELS.showControlWindow, () => {
    createMiniPanelWindow();
    showWindow(miniPanelWindow);
    resizeMiniPanelWindow(true);
  });
  ipcMain.on(IPC_CHANNELS.hideCameraWindow, () => hideWindow(cameraWindow));
  ipcMain.on(IPC_CHANNELS.showCameraWindow, () =>
    showWindow(cameraWindow, false)
  );

  ipcMain.on(IPC_CHANNELS.showTimer, () => {
    createMiniPanelWindow();
    showWindow(miniPanelWindow);
  });

  ipcMain.on(IPC_CHANNELS.hideTimer, () => {
    createMiniPanelWindow();
    showWindow(miniPanelWindow, false);
  });

  ipcMain.on(IPC_CHANNELS.startRecording, () => {
    const sendStartSignal = () =>
      sendToWindow(miniPanelWindow, IPC_CHANNELS.startRecordingTrigger);

    if (hasWindow(miniPanelWindow)) {
      if (miniPanelWindow.webContents.isLoading()) {
        miniPanelWindow.webContents.once('did-finish-load', sendStartSignal);
      } else {
        sendStartSignal();
      }
      return;
    }

    const window = createMiniPanelWindow();
    window.webContents.once('did-finish-load', sendStartSignal);
  });

  ipcMain.on(IPC_CHANNELS.stopRecording, () => {
    sendToWindow(miniPanelWindow, IPC_CHANNELS.stopRecordingTrigger);
  });

  ipcMain.on(IPC_CHANNELS.showMainPanel, () => {
    createMiniPanelWindow();
    showWindow(miniPanelWindow);
    resizeMiniPanelWindow(true);
  });

  ipcMain.on(IPC_CHANNELS.showMiniPanel, () => {
    createMiniPanelWindow();
    showWindow(miniPanelWindow);
    resizeMiniPanelWindow(false);
  });

  ipcMain.on(IPC_CHANNELS.resizeMiniPanel, (_event, expanded: boolean) => {
    resizeMiniPanelWindow(expanded);
  });
};

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(() => {
  void configureMediaPermissions();
  createTray();
  createMiniPanelWindow();
  createCameraWindow();
  registerIpcHandlers();

  app.on('activate', () => {
    if (!hasWindow(miniPanelWindow)) {
      createMiniPanelWindow();
    }
    if (!hasWindow(cameraWindow)) {
      createCameraWindow();
    }
  });
});
