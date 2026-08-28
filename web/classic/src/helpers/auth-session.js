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

import axios from 'axios';

const authClient = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL || '',
  withCredentials: true,
  headers: { 'Cache-Control': 'no-store' },
});

let authBundle = null;
let refreshPromise = null;
const refreshRaceDelays = [80, 200, 500];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object';
}

export function isAuthBundle(value) {
  return (
    isRecord(value) &&
    typeof value.access_token === 'string' &&
    value.access_token.length > 0 &&
    value.token_type === 'Bearer' &&
    Number.isFinite(value.access_expires_at) &&
    isRecord(value.user) &&
    Number.isInteger(value.user.id) &&
    value.user.id > 0 &&
    typeof value.user.username === 'string' &&
    typeof value.user.role === 'number' &&
    isRecord(value.session) &&
    typeof value.session.sid === 'string' &&
    value.session.sid.length > 0 &&
    value.session.current === true
  );
}

export function applyAuthBundle(value) {
  if (!isAuthBundle(value)) {
    throw new Error('Invalid authentication response');
  }
  authBundle = value;
  localStorage.setItem('user', JSON.stringify(value.user));
  return value.user;
}

export function clearAuthSession() {
  authBundle = null;
  localStorage.removeItem('user');
}

export function getAccessToken() {
  return authBundle?.access_token || null;
}

async function requestRefresh(raceAttempt = 0, allowMismatchRetry = true) {
  try {
    const response = await authClient.post(
      '/api/user/auth/refresh',
      undefined,
      {
        headers: authBundle?.session?.sid
          ? { 'X-Auth-Session': authBundle.session.sid }
          : undefined,
      },
    );
    if (response.data?.success !== true || !isAuthBundle(response.data.data)) {
      clearAuthSession();
      return null;
    }
    applyAuthBundle(response.data.data);
    return response.data.data;
  } catch (error) {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if (status === 409 && code === 'AUTH_REFRESH_RACE') {
      const delay = refreshRaceDelays[raceAttempt];
      if (delay !== undefined) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
        return requestRefresh(raceAttempt + 1, allowMismatchRetry);
      }
    }
    if (
      status === 409 &&
      code === 'AUTH_SESSION_MISMATCH' &&
      allowMismatchRetry
    ) {
      authBundle = null;
      return requestRefresh(0, false);
    }
    if (status === 401 || status === 409) {
      clearAuthSession();
      return null;
    }
    throw error;
  }
}

export async function refreshAuthSession() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = requestRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function logoutAuthSession() {
  try {
    await authClient.post('/api/user/auth/logout', undefined, {
      headers: authBundle?.session?.sid
        ? { 'X-Auth-Session': authBundle.session.sid }
        : undefined,
    });
  } finally {
    clearAuthSession();
  }
}
