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

import { describe, expect, it } from 'bun:test';
import {
  MODEL_MARKETPLACE_PATH,
  shouldRedirectOrdinaryUser,
} from '../user-access';

describe('ordinary user page access', () => {
  it('allows an ordinary user to remain on the model marketplace', () => {
    expect(
      shouldRedirectOrdinaryUser({ role: 1 }, MODEL_MARKETPLACE_PATH),
    ).toBe(false);
  });

  it('allows an ordinary user to visit the home page', () => {
    expect(shouldRedirectOrdinaryUser({ role: 1 }, '/')).toBe(false);
  });

  it('redirects an ordinary user away from protected pages', () => {
    expect(shouldRedirectOrdinaryUser({ role: 1 }, '/console')).toBe(true);
    expect(shouldRedirectOrdinaryUser({ role: 1 }, '/about')).toBe(true);
  });

  it('does not restrict administrator routes', () => {
    expect(shouldRedirectOrdinaryUser({ role: 10 }, '/console')).toBe(false);
    expect(shouldRedirectOrdinaryUser({ role: 100 }, '/console')).toBe(false);
  });
});
