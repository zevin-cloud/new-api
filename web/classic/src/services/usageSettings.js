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

import { t } from 'i18next';
import { API } from '../helpers/api';

export function resolveUsageOptions(options) {
  const selfUse =
    options.SelfUseModeEnabled === true ||
    options.SelfUseModeEnabled === 'true';
  const defaults = {
    'usage_setting.allow_unpriced_models_enabled': selfUse,
    'usage_setting.show_unpriced_models_enabled': selfUse,
    'usage_setting.show_registration_enabled': !selfUse,
    'usage_setting.site_label_enabled': selfUse,
    'usage_setting.site_label_text': '自用模式',
  };
  for (const key of Object.keys(defaults)) {
    const value = options[key];
    if (value === undefined || value === null || value === 'null') continue;
    defaults[key] =
      typeof defaults[key] === 'boolean'
        ? value === true || value === 'true'
        : value;
  }
  return defaults;
}

export function getUsageDisplay(status = {}) {
  return {
    showRegistration:
      status.register_enabled !== false &&
      (status.show_registration_enabled ?? !status.self_use_mode_enabled),
    showSiteLabel: status.site_label_enabled ?? !!status.self_use_mode_enabled,
    siteLabelText: status.site_label_text ?? '自用模式',
  };
}

export async function saveUsageSettings(values) {
  // Save label text before enabling its display.
  const entries = Object.entries(values).sort(
    ([a], [b]) =>
      Number(b.endsWith('site_label_text')) -
      Number(a.endsWith('site_label_text')),
  );
  for (const [key, value] of entries) {
    const response = await API.put('/api/option/', {
      key,
      value: String(value),
    });
    if (!response?.data?.success)
      throw new Error(response?.data?.message || t('Unable to save settings'));
  }
}

export async function loadUsageStatus() {
  const response = await API.get('/api/status', { disableDuplicate: true });
  if (!response?.data?.success)
    throw new Error(
      response?.data?.message || t('Unable to refresh site status'),
    );
  return response.data.data;
}
