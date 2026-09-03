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
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Select } from '@douyinfe/semi-ui';
import InspectUserModal from '../modals/InspectUserModal';
import CreateGrantModal from '../modals/CreateGrantModal';

const { api, showError } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  showError: vi.fn(),
}));

vi.mock('../../../../helpers', () => ({
  API: api,
  showError,
  showSuccess: vi.fn(),
  timestamp2string: (timestamp) => new Date(timestamp * 1000).toISOString(),
}));
vi.mock('../../../../helpers/api', () => ({ API: api }));

// jsdom does not emit CSS animation events. Use Select's supported motion
// setting while keeping its real selection and change behavior.
beforeAll(() => {
  Select.defaultProps = { ...Select.defaultProps, motion: false };
});

beforeEach(() => {
  api.get.mockImplementation(async (url) => {
    let data = [];
    if (url.startsWith('/api/department/tree'))
      data = [{ id: 1, name: 'Research' }];
    if (url.startsWith('/api/user/search'))
      data = {
        items: [
          { id: 2, username: 'alice', display_name: 'Alice', department_id: 1 },
        ],
        total: 1,
      };
    if (url.startsWith('/api/user-group')) data = { items: [], total: 0 };
    if (url.startsWith('/api/model-set'))
      data = {
        items: [{ id: 3, name: 'Research models', status: 1 }],
        total: 1,
      };
    return { data: { success: true, data } };
  });
  api.post.mockResolvedValue({ data: { success: true } });
});

it('keeps a selected individual as a direct grant when they are the only displayed department member', async () => {
  render(<CreateGrantModal visible onClose={vi.fn()} onSuccess={vi.fn()} />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Grant access/ })).toBeEnabled()
  );
  fireEvent.click(screen.getByText('Search departments or members...'));
  const department = await screen.findByText(/^Research \(/);
  fireEvent.click(
    department
      .closest('[role=treeitem]')
      .querySelector('.semi-tree-option-expand-icon')
  );
  // Select the member itself, without selecting the department checkbox.
  const member = await screen.findByText('Alice (@alice)');
  fireEvent.click(member);
  fireEvent.click(screen.getByText('Select model sets...'));
  fireEvent.click(await screen.findByText('Research models'));
  fireEvent.click(screen.getByRole('button', { name: /Grant access/ }));
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  expect(api.post.mock.calls[0][1]).toMatchObject({
    department_ids: [],
    user_ids: [2],
    model_set_ids: [3],
  });
});

it('shows unrestricted model access for administrators even when model metadata is empty', async () => {
  api.get.mockImplementation(async (url) => ({
    data: {
      success: true,
      data: url.startsWith('/api/user/search')
        ? { items: [{ id: 1, username: 'admin' }], total: 1 }
        : { is_admin: true, effective_models: [] },
    },
  }));
  render(<InspectUserModal visible onClose={vi.fn()} />);
  fireEvent.click(screen.getByText('Search and select a user...'));
  const adminOption = await screen.findByText('admin (@admin)');
  fireEvent.click(adminOption);

  await waitFor(() =>
    expect(
      api.get.mock.calls.some(([url]) => url === '/api/model-grant/inspect/1')
    ).toBe(true)
  );
  expect(showError).not.toHaveBeenCalled();
  expect(await screen.findByText('All models available')).toBeInTheDocument();
  expect(
    screen.queryByText('This user has no active model access')
  ).not.toBeInTheDocument();
});
