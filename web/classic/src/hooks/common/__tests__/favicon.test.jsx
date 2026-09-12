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

import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { useFavicon } from '../useFavicon';

beforeEach(() => {
  document.head.innerHTML =
    '<link rel="icon" href="/logo.png"><link rel="icon" href="/favicon.ico">';
});

it('updates all favicon candidates when the server logo arrives', () => {
  const { rerender } = renderHook(({ logo }) => useFavicon(logo), {
    initialProps: { logo: '/logo.png' },
  });
  rerender({ logo: 'https://example.com/custom.svg' });
  const icons = [...document.querySelectorAll('link[rel~="icon"]')];
  expect(icons.length).toBeGreaterThan(0);
  icons.forEach((icon) =>
    expect(icon.href).toBe('https://example.com/custom.svg'),
  );
});

it('restores the default when the custom logo is cleared', () => {
  const { rerender } = renderHook(({ logo }) => useFavicon(logo), {
    initialProps: { logo: '/custom.png' },
  });
  rerender({ logo: '' });
  document.querySelectorAll('link[rel~="icon"]').forEach((icon) => {
    expect(icon.getAttribute('href')).toBe('/logo.png');
  });
});

it('creates a favicon if none exists', () => {
  document.head.innerHTML = '';
  renderHook(() => useFavicon('/custom.png'));
  expect(document.querySelector('link[rel="icon"]').getAttribute('href')).toBe(
    '/custom.png',
  );
});
