import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MiniPanel from '../src/views/MiniPanel';
import type { ElectronAPI } from '../electron/ipc-contract';

type ElectronApiWithResize = ElectronAPI & {
  resizeMiniPanel: ReturnType<typeof vi.fn>;
};

type TeleprompterCallback = () => void;

const createElectronApiMock = (): ElectronApiWithResize => ({
  getSources: vi.fn().mockResolvedValue([
    { id: 'screen:1:0', name: 'Tela principal', thumbnail: '' },
    { id: 'window:2:0', name: 'Janela secundária', thumbnail: '' },
  ]),
  setCameraShape: vi.fn(),
  onCameraShapeChange: vi.fn(() => () => undefined),
  onCameraStatusChange: vi.fn(() => () => undefined),
  setTeleprompterText: vi.fn(),
  onTeleprompterTextChange: vi.fn(() => () => undefined),
  getTeleprompterText: vi.fn().mockResolvedValue(''),
  saveRecording: vi.fn(),
  setCameraSize: vi.fn(),
  closeTeleprompter: vi.fn(),
  toggleTeleprompter: vi.fn(),
  openTeleprompter: vi.fn(),
  hideCameraWindow: vi.fn(),
  showCameraWindow: vi.fn(),
  showTimer: vi.fn(),
  hideTimer: vi.fn(),
  stopRecording: vi.fn(),
  onStopRecordingTrigger: vi.fn(() => () => undefined),
  startRecording: vi.fn(),
  onStartRecordingTrigger: vi.fn(() => () => undefined),
  broadcastRecordingState: vi.fn(),
  onRecordingStateChange: vi.fn(() => () => undefined),
  getRecordingState: vi.fn().mockResolvedValue(false),
  resizeMiniPanel: vi.fn(),
  teleprompterPlay: vi.fn(),
  teleprompterPause: vi.fn(),
  teleprompterReset: vi.fn(),
  teleprompterSetSpeed: vi.fn(),
  onTeleprompterWindowOpened: vi.fn(() => () => undefined),
  onTeleprompterWindowClosed: vi.fn(() => () => undefined),
  onTeleprompterPlay: vi.fn(() => () => undefined),
  onTeleprompterPause: vi.fn(() => () => undefined),
  onTeleprompterReset: vi.fn(() => () => undefined),
  onTeleprompterSetSpeed: vi.fn(() => () => undefined),
  teleprompterScrollDone: vi.fn(),
  onTeleprompterScrollDone: vi.fn(() => () => undefined),
});

describe('MiniPanel', () => {
  beforeEach(() => {
    window.electronAPI = createElectronApiMock() as ElectronAPI;
  });

  it('starts in compact mode and hides advanced controls', async () => {
    render(<MiniPanel />);

    expect(
      screen.getByRole('button', { name: /expandir controles/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/fonte de gravação/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/formato de exportação/i)
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(window.electronAPI.getRecordingState).toHaveBeenCalled();
    });
  });

  it('expands the panel and reveals the full controls', async () => {
    const user = userEvent.setup();
    render(<MiniPanel />);

    await user.click(
      screen.getByRole('button', { name: /expandir controles/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/fonte de gravação/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/formato de exportação/i)).toBeInTheDocument();
    expect(
      (window.electronAPI as ElectronApiWithResize).resizeMiniPanel
    ).toHaveBeenCalledWith(true);
  });

  it('sends the latest speed when the teleprompter window opens', async () => {
    const user = userEvent.setup();
    const electronApi = createElectronApiMock();
    let onWindowOpened: TeleprompterCallback | undefined;

    electronApi.onTeleprompterWindowOpened.mockImplementation((callback) => {
      onWindowOpened = callback;
      return () => undefined;
    });

    window.electronAPI = electronApi;

    render(<MiniPanel />);

    await user.click(
      screen.getByRole('button', { name: /expandir controles/i })
    );

    const speedSlider = await screen.findByRole('slider', {
      name: /velocidade do teleprompter/i,
    });

    fireEvent.change(speedSlider, { target: { value: '1.7' } });

    act(() => {
      onWindowOpened?.();
    });

    expect(electronApi.teleprompterSetSpeed).toHaveBeenLastCalledWith(1.7);
  });
});
