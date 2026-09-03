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

function unwrap(response) {
  if (!response.data?.success)
    throw new Error(
      response.data?.message || t('Unable to load authorization data')
    );
  return response.data.data;
}

// User search enforces a maximum of 100 rows per page. Follow total rather
// than requesting a larger page and silently omitting most of the organization.
async function loadAllPages(url, pageKey, signal) {
  const items = [];
  const seen = new Set();
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ [pageKey]: page, page_size: 100 });
    const data = unwrap(
      await API.get(url + '?' + params, { signal, disableDuplicate: true })
    );
    if (!Array.isArray(data?.items) || !Number.isFinite(data.total))
      throw new Error(t('Unable to load authorization data'));
    let added = 0;
    for (const item of data.items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
        added++;
      }
    }
    if (items.length >= data.total) return items;
    if (added === 0) throw new Error(t('Unable to load authorization data'));
  }
}

export const loadGrantUsers = (signal) =>
  loadAllPages('/api/user/search', 'p', signal);
export const loadGrantModelSets = (signal) =>
  loadAllPages('/api/model-set', 'page', signal);

export async function loadGrantOptions(signal) {
  const [depts, users, groups, sets, enabled, pricing] = await Promise.all([
    API.get('/api/department/tree', { signal, disableDuplicate: true }).then(
      unwrap
    ),
    loadGrantUsers(signal),
    loadAllPages('/api/user-group', 'page', signal),
    loadGrantModelSets(signal),
    API.get('/api/channel/models_enabled', {
      signal,
      disableDuplicate: true,
    }).then(unwrap),
    API.get('/api/pricing', { signal, disableDuplicate: true }).then(unwrap),
  ]);
  const models = new Set();
  for (const model of [...(enabled || []), ...(pricing || [])]) {
    const name =
      typeof model === 'string'
        ? model
        : model.model_name || model.id || model.name;
    if (name) models.add(name);
  }
  return {
    depts: depts || [],
    users,
    groups: groups.filter((g) => g.status === 1),
    sets: sets.filter((s) => s.status === 1),
    models: [...models].sort(),
  };
}

export async function listGrants(page, pageSize, filters, signal) {
  const params = new URLSearchParams({
    page,
    page_size: pageSize,
  });
  for (const [key, value] of Object.entries(filters || {}))
    if (value) params.set(key, value);
  return unwrap(
    await API.get('/api/model-grant?' + params, {
      signal,
      disableDuplicate: true,
    })
  );
}

export const listGrantBatches = listGrants;

export const createGrantBatch = async (request) =>
  unwrap(await API.post('/api/model-grant', request));
export const revokeGrant = async (id) =>
  unwrap(await API.delete('/api/model-grant/' + id));
export const batchRevokeGrants = async (ids) => {
  if (!ids || ids.length === 0) return;
  const results = await Promise.allSettled(
    ids.map((id) => API.delete('/api/model-grant/' + id).then(unwrap))
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    throw new Error(`部分授权撤销失败 (${failed.length}/${ids.length})`);
  }
};
export const getGrantBatchDetail = async (id, signal) =>
  unwrap(
    await API.get('/api/model-grant/batch/' + id + '/detail', {
      signal,
      disableDuplicate: true,
    })
  );

export const updateGrantBatch = async (oldBatch, newRequest) => {
  const newBatch = await createGrantBatch(newRequest);
  try {
    if (oldBatch?.batch_id > 0 || oldBatch?.batchId > 0) {
      await revokeGrantBatch(oldBatch.batch_id || oldBatch.batchId);
    } else {
      const grantId =
        oldBatch?.legacy_id ||
        oldBatch?.legacyId ||
        (Array.isArray(oldBatch?.grants) && oldBatch.grants[0]?.id) ||
        oldBatch?.id;
      if (grantId) await revokeGrant(grantId);
    }
  } catch (e) {
    // ignore
  }
  return newBatch;
};

export const batchRevokeGrantBatches = async (batchItems) => {
  if (!batchItems || batchItems.length === 0) return;
  const results = await Promise.allSettled(
    batchItems.map((item) => {
      if (item.batch_id > 0) {
        return API.delete('/api/model-grant/batch/' + item.batch_id).then(unwrap);
      }
      const grantId =
        item.legacy_id ||
        (Array.isArray(item.grants) && item.grants[0]?.id) ||
        item.id;
      return API.delete('/api/model-grant/' + grantId).then(unwrap);
    })
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    throw new Error(`部分授权撤销失败 (${failed.length}/${batchItems.length})`);
  }
};

export const revokeGrantBatch = async (id) =>
  unwrap(await API.delete('/api/model-grant/batch/' + id));
export const inspectGrantUser = async (id, signal) =>
  unwrap(
    await API.get('/api/model-grant/inspect/' + id, {
      signal,
      disableDuplicate: true,
    })
  );

export async function loadGrantSubjects(type, signal) {
  if (type === 1)
    return (
      unwrap(
        await API.get('/api/department', { signal, disableDuplicate: true })
      ) || []
    );
  if (type === 2) return loadAllPages('/api/user-group', 'page', signal);
  return loadGrantUsers(signal);
}
