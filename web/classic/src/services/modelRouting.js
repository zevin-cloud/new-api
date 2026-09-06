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

import { API } from '../helpers/api';
import { t } from 'i18next';

export async function loadRoutingPools() {
  const response = await API.get('/api/group/');
  if (!response.data?.success)
    throw new Error(t('Unable to load authorization data'));
  return (response.data.data || []).filter(
    (group) => group !== 'auto' && group !== '@model',
  );
}

export function parseRoutingPools(value) {
  if (!value) return [];
  const groups = JSON.parse(value);
  if (!Array.isArray(groups)) throw new Error(t('Invalid model routing pools'));
  return groups;
}
