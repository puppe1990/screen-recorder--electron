import { describe, expect, it, vi } from 'vitest';
import { createElectronApi } from '../electron/createElectronApi';
import { IPC_CHANNELS } from '../electron/ipc-contract';

const createMockIpc = () => {
  const listeners = new Map<string, (...args: unknown[]) => void>();

  return {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      listeners.set(channel, listener);
    }),
    removeListener: vi.fn((channel: string) => {
      listeners.delete(channel);
    }),
    emit(channel: string, payload?: unknown) {
      const listener = listeners.get(channel);
      if (listener) {
        listener({}, payload);
      }
    },
  };
};

describe('createElectronApi', () => {
  it('exposes the expected bridge methods', () => {
    const ipc = createMockIpc();
    const api = createElectronApi(ipc);

    expect(api).toMatchObject({
      getSources: expect.any(Function),
      setCameraShape: expect.any(Function),
      onCameraShapeChange: expect.any(Function),
      saveRecording: expect.any(Function),
      startRecording: expect.any(Function),
      onStartRecordingTrigger: expect.any(Function),
      getRecordingState: expect.any(Function),
    });
  });

  it('registers and cleans up event listeners', () => {
    const ipc = createMockIpc();
    const api = createElectronApi(ipc);
    const callback = vi.fn();

    const cleanup = api.onCameraShapeChange(callback);
    ipc.emit(IPC_CHANNELS.cameraShapeChanged, 'rounded');

    expect(callback).toHaveBeenCalledWith('rounded');

    cleanup();

    expect(ipc.removeListener).toHaveBeenCalledWith(
      IPC_CHANNELS.cameraShapeChanged,
      expect.any(Function)
    );
  });
});
