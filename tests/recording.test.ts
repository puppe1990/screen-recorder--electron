import { describe, expect, it } from 'vitest';
import { getFormatHelperText, getSaveResultMessage, resolveRecorderMimeType, resolveSaveExtension } from '../src/lib/recording';

describe('recording helpers', () => {
  it('selects a supported MIME type with audio when available', () => {
    const mimeType = resolveRecorderMimeType('webm-vp9', true, (candidate) =>
      candidate === 'video/webm;codecs=vp9,opus'
    );

    expect(mimeType).toBe('video/webm;codecs=vp9,opus');
  });

  it('falls back to an empty MIME type when none are supported', () => {
    const mimeType = resolveRecorderMimeType('mp4', true, () => false);

    expect(mimeType).toBe('');
  });

  it('resolves save extensions and save messages', () => {
    expect(resolveSaveExtension('mp4')).toBe('mp4');
    expect(resolveSaveExtension('webm-vp8')).toBe('webm');
    expect(getFormatHelperText('mp4')).toContain('convertida para MP4');
    expect(
      getSaveResultMessage({
        ok: false,
        code: 'WRITE_FAILED',
        message: 'Falha ao escrever arquivo.',
      })
    ).toBe('Falha ao escrever arquivo.');
  });
});
