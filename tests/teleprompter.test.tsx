import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Teleprompter from '../src/views/Teleprompter';
import type { ElectronAPI } from '../electron/ipc-contract';

type SpeedCallback = (speed: number) => void;

const createElectronApiMock = (): ElectronAPI => ({
  getSources: vi.fn().mockResolvedValue([]),
  setCameraShape: vi.fn(),
  onCameraShapeChange: vi.fn(() => () => undefined),
  onCameraStatusChange: vi.fn(() => () => undefined),
  setTeleprompterText: vi.fn(),
  onTeleprompterTextChange: vi.fn(() => () => undefined),
  getTeleprompterText: vi.fn().mockResolvedValue('texto curto'),
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

describe('Teleprompter', () => {
  beforeEach(() => {
    window.electronAPI = createElectronApiMock();
  });

  it('updates the displayed speed when receiving a remote speed command', async () => {
    const electronApi = createElectronApiMock();
    let onSpeedChange: SpeedCallback | undefined;

    electronApi.onTeleprompterSetSpeed.mockImplementation((callback) => {
      onSpeedChange = callback;
      return () => undefined;
    });

    window.electronAPI = electronApi;

    render(<Teleprompter />);

    await waitFor(() => {
      expect(screen.getByText('texto curto')).toBeInTheDocument();
    });

    act(() => {
      onSpeedChange?.(1.7);
    });

    expect(screen.getByText('1.7x')).toBeInTheDocument();
  });

  it('removes the window resize listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<Teleprompter />);

    const resizeRegistration = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'resize'
    );

    expect(resizeRegistration).toBeDefined();

    const resizeHandler = resizeRegistration?.[1];

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      resizeHandler
    );
  });
});
