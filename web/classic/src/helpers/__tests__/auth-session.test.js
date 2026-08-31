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

import { beforeEach, describe, expect, it } from 'bun:test';
import {
  applyAuthBundle,
  clearAuthSession,
  getAccessToken,
  isAuthBundle,
} from '../auth-session';

const bundle = {
  access_token: 'access-token',
  token_type: 'Bearer',
  access_expires_at: 2000000000,
  user: { id: 1, username: 'root', role: 100 },
  session: {
    sid: 'session-id',
    current: true,
  },
};

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  clearAuthSession();
});

describe('Classic auth session', () => {
  it('accepts the latest backend auth bundle and stores only user data', () => {
    expect(isAuthBundle(bundle)).toBe(true);

    const user = applyAuthBundle(bundle);

    expect(user).toEqual(bundle.user);
    expect(getAccessToken()).toBe(bundle.access_token);
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(bundle.user);
  });

  it('rejects legacy login payloads without a backend session', () => {
    expect(isAuthBundle({ ...bundle, session: undefined })).toBe(false);
    expect(isAuthBundle({ ...bundle, token_type: 'Basic' })).toBe(false);
  });
});
