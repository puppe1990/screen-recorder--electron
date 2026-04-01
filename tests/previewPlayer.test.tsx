import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PreviewPlayer from '../src/views/PreviewPlayer';

describe('PreviewPlayer', () => {
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

    const actionButtons = screen.getAllByRole('button', { name: /salvando/i });
    expect(actionButtons).toHaveLength(2);
    expect(
      actionButtons.every((button) => button.hasAttribute('disabled'))
    ).toBe(true);

    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('dialog', { name: /descartar gravação/i })
    ).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
