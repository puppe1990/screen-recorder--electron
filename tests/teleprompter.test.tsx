import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Teleprompter from '../src/views/Teleprompter';
import type { ElectronAPI } from '../electron/ipc-contract';

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
});

describe('Teleprompter', () => {
  beforeEach(() => {
    window.electronAPI = createElectronApiMock();
  });

  it('shows 100% progress when the content already fits the viewport', async () => {
    render(<Teleprompter />);

    const progress = screen.getByRole('progressbar', {
      name: /progresso da rolagem/i,
    });

    await waitFor(() => {
      expect(screen.getByText('texto curto')).toBeInTheDocument();
    });

    const content = screen.getByText('texto curto');
    const viewport = content.parentElement;
    if (!viewport) {
      throw new Error('Expected teleprompter viewport to exist');
    }

    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(content, 'scrollHeight', {
      configurable: true,
      value: 400,
    });

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(progress).toHaveAttribute('aria-valuenow', '100');
    });
  });
});
