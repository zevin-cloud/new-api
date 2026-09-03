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

import { beforeEach, expect, it, vi } from 'vitest';
import { loadGrantUsers, createGrantBatch } from '../modelGrants';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../helpers/api', () => ({ API: api }));
beforeEach(() => vi.clearAllMocks());
it('loads every user when the server caps pages at 100', async () => {
  const users = Array.from({ length: 137 }, (_, i) => ({
    id: i + 1,
    username: 'user-' + i,
  }));
  api.get.mockImplementation(async (url) => {
    const query = new URL(url, 'http://localhost').searchParams;
    const start = (Number(query.get('p')) - 1) * 100;
    return {
      data: {
        success: true,
        data: { items: users.slice(start, start + 100), total: 137 },
      },
    };
  });
  expect(await loadGrantUsers()).toEqual(users);
  expect(api.get).toHaveBeenCalledTimes(2);
});
it('reports incomplete pagination instead of presenting a truncated organization', async () => {
  api.get.mockResolvedValue({
    data: { success: true, data: { items: [{ id: 1 }], total: 200 } },
  });
  await expect(loadGrantUsers()).rejects.toThrow();
});
it('propagates a rejected batch as an error', async () => {
  api.post.mockResolvedValue({
    data: { success: false, message: 'invalid subject' },
  });
  await expect(createGrantBatch({ user_ids: [999] })).rejects.toThrow(
    'invalid subject'
  );
});
