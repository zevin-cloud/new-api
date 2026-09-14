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

import { expect, it } from 'vitest';
import { resolveUsageOptions, getUsageDisplay } from '../usageSettings';

it.each([false, true])(
  'preserves the legacy preset %s until a switch is explicitly saved',
  (legacy) => {
    const values = resolveUsageOptions({ SelfUseModeEnabled: String(legacy) });
    expect(values['usage_setting.allow_unpriced_models_enabled']).toBe(legacy);
    expect(values['usage_setting.show_unpriced_models_enabled']).toBe(legacy);
    expect(values['usage_setting.show_registration_enabled']).toBe(!legacy);
    expect(values['usage_setting.site_label_enabled']).toBe(legacy);
    expect(
      resolveUsageOptions({
        SelfUseModeEnabled: true,
        'usage_setting.site_label_enabled': 'false',
      })['usage_setting.site_label_enabled'],
    ).toBe(false);
  },
);

it('keeps registration visibility independent from the label and honors registration closure', () => {
  expect(
    getUsageDisplay({
      self_use_mode_enabled: true,
      show_registration_enabled: true,
      site_label_enabled: false,
      site_label_text: 'Internal',
    }),
  ).toEqual({
    showRegistration: true,
    showSiteLabel: false,
    siteLabelText: 'Internal',
  });
  expect(
    getUsageDisplay({
      register_enabled: false,
      show_registration_enabled: true,
    }).showRegistration,
  ).toBe(false);
});
