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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import UsageSettings from '../UsageSettings';
import { API } from '../../../helpers/api';
vi.mock('../../../helpers/api', () => ({
  API: { get: vi.fn(), put: vi.fn() },
}));

beforeEach(() => {
  API.put.mockResolvedValue({ data: { success: true } });
  API.get.mockResolvedValue({
    data: {
      success: true,
      data: { site_label_enabled: true, site_label_text: 'Internal' },
    },
  });
});

it('saves model call permission without changing listing permission', async () => {
  render(<UsageSettings section='models' options={{}} refresh={vi.fn()} />);
  fireEvent.click(
    screen.getByRole('switch', { name: 'Allow requests to unpriced models' }),
  );
  expect(
    screen.getByRole('switch', { name: 'Show unpriced models' }),
  ).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save these settings' }));
  await screen.findByRole('status');
  expect(API.put).toHaveBeenCalledExactlyOnceWith('/api/option/', {
    key: 'usage_setting.allow_unpriced_models_enabled',
    value: 'true',
  });
});

it('validates label length and whitespace, then saves literal custom text', async () => {
  render(<UsageSettings section='label' options={{}} refresh={vi.fn()} />);
  const input = screen.getByRole('textbox', { name: 'Site label text' });
  const save = screen.getByRole('button', { name: 'Save these settings' });
  for (const value of ['   ', '字'.repeat(21)]) {
    fireEvent.change(input, { target: { value } });
    expect(save).toBeDisabled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  }
  fireEvent.change(input, { target: { value: '😀'.repeat(20) } });
  expect(save).toBeEnabled();
  fireEvent.change(input, { target: { value: ' Internal ' } });
  fireEvent.click(save);
  await screen.findByRole('status');
  expect(API.put).toHaveBeenCalledExactlyOnceWith('/api/option/', {
    key: 'usage_setting.site_label_text',
    value: 'Internal',
  });
});

it('keeps edits available after the server rejects saving', async () => {
  API.put.mockResolvedValue({ data: { success: false, message: 'Rejected' } });
  render(
    <UsageSettings section='registration' options={{}} refresh={vi.fn()} />,
  );
  fireEvent.click(
    screen.getByRole('switch', { name: 'Show registration entry' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save these settings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Rejected');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Save these settings' }),
    ).toBeEnabled(),
  );
});

it('keeps registration compact with help out of flow and save shown only for edits', async () => {
  render(
    <UsageSettings section='registration' options={{}} refresh={vi.fn()} />,
  );
  const control = screen.getByRole('switch', {
    name: 'Show registration entry',
  });
  expect(
    screen.queryByRole('button', { name: 'Save these settings' }),
  ).not.toBeInTheDocument();
  const description = document.getElementById(
    control.getAttribute('aria-describedby'),
  );
  expect(description).toHaveClass('sr-only');
  fireEvent.click(control);
  fireEvent.click(screen.getByRole('button', { name: 'Save these settings' }));
  expect(await screen.findByRole('status')).toHaveClass('sr-only');
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Save these settings' }),
    ).not.toBeInTheDocument(),
  );
});
