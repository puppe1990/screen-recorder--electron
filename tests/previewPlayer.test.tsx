import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PreviewPlayer from '../src/views/PreviewPlayer';

describe('PreviewPlayer', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve()
    );
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  it('does not allow discard interactions while saving', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <PreviewPlayer
        videoBlob={new Blob(['video'], { type: 'video/webm' })}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={onCancel}
        isSaving={true}
      />
    );

    expect(
      screen.getByRole('button', { name: /convertendo|salvando/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /^descartar$/i })).toBeDisabled();

    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('dialog', { name: /descartar gravação/i })
    ).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('opens the discard confirmation with Escape when not saving', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <PreviewPlayer
        videoBlob={new Blob(['video'], { type: 'video/webm' })}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={onCancel}
        isSaving={false}
      />
    );

    await user.keyboard('{Escape}');

    expect(
      screen.getByRole('dialog', { name: /descartar gravação/i })
    ).toBeInTheDocument();

    await user.click(
      screen.getAllByRole('button', { name: /^descartar$/i }).at(-1)!
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('toggles playback with the space key when not saving', async () => {
    const user = userEvent.setup();

    render(
      <PreviewPlayer
        videoBlob={new Blob(['video'], { type: 'video/webm' })}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
        isSaving={false}
      />
    );

    await user.keyboard(' ');

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it('defaults to MP4 and allows changing the save format', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <PreviewPlayer
        videoBlob={new Blob(['video'], { type: 'video/webm' })}
        onSave={onSave}
        onCancel={vi.fn()}
        isSaving={false}
      />
    );

    expect(
      screen.getByRole('button', { name: /salvar mp4/i })
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('preview-format-webm-vp9'));

    expect(
      screen.getByRole('button', { name: /salvar vp9/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /salvar vp9/i }));

    expect(onSave).toHaveBeenCalledWith('webm-vp9');
  });

  it('uses the format chosen in the mini panel as the preview default', async () => {
    render(
      <PreviewPlayer
        videoBlob={new Blob(['video'], { type: 'video/webm' })}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
        isSaving={false}
        initialFormat="webm-vp8"
      />
    );

    expect(
      screen.getByRole('button', { name: /salvar vp8/i })
    ).toBeInTheDocument();
  });
});
