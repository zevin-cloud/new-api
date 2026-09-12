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
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { StatusContext } from '../../../context/Status';
import Home from '../index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'en' } }),
}));

vi.mock('../../../hooks/common/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('../../../helpers', () => ({
  API: { get: vi.fn(() => Promise.resolve({ data: { success: false } })) },
}));

vi.mock('../../../components/layout/NoticeModal', () => ({
  default: () => null,
}));

vi.mock('../../../components/home/DeepSeekHeader', () => ({
  default: () => null,
}));

vi.mock('../../../components/home/DeepSeekHeroFluid', () => ({
  default: () => null,
}));

vi.mock('../../../components/home/DeepSeekGrid', () => ({
  default: () => null,
}));

vi.mock('../../../components/home/HeroTerminalCard', () => ({
  default: () => null,
}));

vi.mock('../../../components/home/DeepSeekWhale', () => ({
  default: (props) => <div data-testid='hero-logo' data-src={props.src} />,
}));

beforeEach(() => {
  localStorage.clear();
});

it('keeps only responsive console actions and removes secondary hero actions', () => {
  render(
    <StatusContext.Provider value={[{ status: {} }, vi.fn()]}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </StatusContext.Provider>,
  );

  expect(
    screen.getAllByRole('link', { name: /console|get started/i }),
  ).toHaveLength(2);
  expect(
    screen.queryByRole('link', { name: /documentation|docs|github/i }),
  ).toBeNull();
  expect(screen.queryByRole('button', { name: /copy/i })).toBeNull();
});

it('uses the configured site logo for the hero particle silhouette', () => {
  render(
    <StatusContext.Provider
      value={[{ status: { logo: '/custom-logo.png' } }, vi.fn()]}
    >
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </StatusContext.Provider>,
  );

  expect(screen.getByTestId('hero-logo')).toHaveAttribute(
    'data-src',
    '/custom-logo.png',
  );
});
