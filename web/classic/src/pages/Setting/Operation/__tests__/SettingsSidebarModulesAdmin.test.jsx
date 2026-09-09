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
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SettingsSidebarModulesAdmin from '../SettingsSidebarModulesAdmin';
import { StatusContext } from '../../../../context/Status';
import { API } from '../../../../helpers';

vi.mock('../../../../helpers', () => ({
  API: {
    put: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('renders section cards and allows moving sections up and down', async () => {
  const dispatch = vi.fn();
  render(
    <StatusContext.Provider value={[{ status: {} }, dispatch]}>
      <SettingsSidebarModulesAdmin />
    </StatusContext.Provider>,
  );

  // Initial order has Operations overview first
  const overviewTitle = screen.getByText('Operations overview');
  expect(overviewTitle).toBeInTheDocument();

  // Click move down button on Operations overview
  const moveDownBtn = screen.getByRole('button', { name: '下移Operations overview' });
  fireEvent.click(moveDownBtn);

  // Now Model resources should be above Operations overview
  const headings = screen.getAllByText(/Operations overview|Model resources/);
  expect(headings[0]).toHaveTextContent('Model resources');
  expect(headings[1]).toHaveTextContent('Operations overview');

  // Save settings
  const saveBtn = screen.getByRole('button', { name: '保存设置' });
  fireEvent.click(saveBtn);

  await waitFor(() => {
    expect(API.put).toHaveBeenCalledWith(
      '/api/option/',
      expect.objectContaining({
        key: 'SidebarModulesAdmin',
        value: expect.stringContaining('"sectionOrder":["resources","overview"'),
      }),
    );
  });
});

it('allows moving modules within a section and saving new order', async () => {
  const dispatch = vi.fn();
  render(
    <StatusContext.Provider value={[{ status: {} }, dispatch]}>
      <SettingsSidebarModulesAdmin />
    </StatusContext.Provider>,
  );

  // Find playground move up button
  const moveUpPlayground = screen.getByRole('button', { name: '上移操练场' });
  fireEvent.click(moveUpPlayground);

  // Save settings
  const saveBtn = screen.getByRole('button', { name: '保存设置' });
  fireEvent.click(saveBtn);

  await waitFor(() => {
    expect(API.put).toHaveBeenCalledWith(
      '/api/option/',
      expect.objectContaining({
        key: 'SidebarModulesAdmin',
        value: expect.stringContaining('"playground","deployment"'),
      }),
    );
  });
});

it('resets to default order and settings when reset button is clicked', async () => {
  const dispatch = vi.fn();
  render(
    <StatusContext.Provider value={[{ status: {} }, dispatch]}>
      <SettingsSidebarModulesAdmin />
    </StatusContext.Provider>,
  );

  // Move down overview
  fireEvent.click(screen.getByRole('button', { name: '下移Operations overview' }));
  const headings = screen.getAllByText(/Operations overview|Model resources/);
  expect(headings[0]).toHaveTextContent('Model resources');

  // Click reset
  fireEvent.click(
    screen.getByRole('button', {
      name: /Reset to default configuration|重置为默认配置/,
    }),
  );

  // Order should be restored
  const headingsAfter = screen.getAllByText(/Operations overview|Model resources/);
  expect(headingsAfter[0]).toHaveTextContent('Operations overview');
});

