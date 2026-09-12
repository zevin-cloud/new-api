/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LogoSetting from '../LogoSetting';

beforeEach(() => {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width: 512, height: 256, close: vi.fn() }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/png;base64,aWNvbg==',
  );
});
afterEach(() => vi.unstubAllGlobals());

it('keeps URL editing and saves the entered URL', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<LogoSetting value='/old.png' onSave={save} />);
  fireEvent.change(screen.getByLabelText('Logo image URL'), {
    target: { value: 'https://example.com/new.svg' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save logo' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith('https://example.com/new.svg'),
  );
});

it('previews a selected image and uploads it only when Save is clicked', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<LogoSetting value='/old.png' onSave={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
  fireEvent.change(screen.getByLabelText('Choose logo image'), {
    target: { files: [new File(['image'], 'logo.png', { type: 'image/png' })] },
  });
  await waitFor(() =>
    expect(screen.getByAltText('Logo preview')).toHaveAttribute(
      'src',
      'data:image/png;base64,aWNvbg==',
    ),
  );
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText('logo.png')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Choose logo image' }),
  ).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save logo' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith('data:image/png;base64,aWNvbg=='),
  );
});

it('rejects oversized images before decoding or saving', async () => {
  const save = vi.fn();
  render(<LogoSetting value='' onSave={save} />);
  fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
  fireEvent.change(screen.getByLabelText('Choose logo image'), {
    target: {
      files: [
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {
          type: 'image/png',
        }),
      ],
    },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Choose a PNG, JPEG or WebP image up to 5 MB.',
  );
  expect(createImageBitmap).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it('keeps the draft and shows an error when saving fails', async () => {
  render(
    <LogoSetting
      value='/old.png'
      onSave={vi.fn().mockRejectedValue(new Error('network'))}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save logo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not save the logo. Please try again.',
  );
  expect(screen.getByLabelText('Logo image URL')).toHaveValue('/old.png');
});

it('rejects non-image uploads without decoding them', async () => {
  render(<LogoSetting value='' onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
  fireEvent.change(screen.getByLabelText('Choose logo image'), {
    target: {
      files: [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })],
    },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Choose a PNG, JPEG or WebP image up to 5 MB.',
  );
  expect(createImageBitmap).not.toHaveBeenCalled();
});

it('reports corrupt images without enabling save', async () => {
  createImageBitmap.mockRejectedValue(new Error('decode failed'));
  render(<LogoSetting value='' onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
  fireEvent.change(screen.getByLabelText('Choose logo image'), {
    target: {
      files: [new File(['broken'], 'logo.png', { type: 'image/png' })],
    },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not read this image. Please choose another image.',
  );
  expect(screen.getByRole('button', { name: 'Save logo' })).toBeDisabled();
});

it('restores an uploaded logo after reopening and preserves URL drafts when switching modes', () => {
  const { rerender } = render(
    <LogoSetting value='data:image/png;base64,aWNvbg==' onSave={vi.fn()} />,
  );
  expect(screen.getByRole('button', { name: 'Upload image' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByAltText('Logo preview')).toHaveAttribute(
    'src',
    'data:image/png;base64,aWNvbg==',
  );
  rerender(<LogoSetting value='/old.png' onSave={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Logo image URL'), {
    target: { value: '/draft.png' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Upload image' }));
  fireEvent.click(screen.getByRole('button', { name: 'Image URL' }));
  expect(screen.getByLabelText('Logo image URL')).toHaveValue('/draft.png');
});
