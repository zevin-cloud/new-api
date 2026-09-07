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

async function result(request) {
  const response = await request;
  if (!response.data?.success)
    throw new Error(response.data?.message || 'Request failed');
  return response.data.data;
}

export const clientAuth = {
  test: async (account) => {
    const response = await API.get(`/api/channel/test/${account.id}`, {
      params: {
        model: account.models.split(',')[0],
        endpoint_type:
          account.provider === 'codex' ? 'openai-response' : 'openai',
        stream: true,
      },
    });
    if (!response.data?.success)
      throw new Error(response.data?.message || 'Request failed');
    return response.data;
  },
  providers: (signal) =>
    result(API.get('/api/channel/client_auth/providers', { signal })),
  accounts: (page, signal) =>
    result(
      API.get('/api/channel/client_auth/channels', {
        params: { p: page, page_size: 20 },
        signal,
      }),
    ),
  start: (provider, signal) =>
    result(API.post('/api/channel/client_auth/init', { provider }, { signal })),
  poll: (session_id, signal) =>
    result(
      API.post('/api/channel/client_auth/poll', { session_id }, { signal }),
    ),
  exchange: (session_id, code, signal) =>
    result(
      API.post(
        '/api/channel/client_auth/exchange',
        { session_id, code },
        { signal },
      ),
    ),
  create: (payload) =>
    result(API.post('/api/channel/client_auth/create_channel', payload)),
  status: (id, status) =>
    result(API.post(`/api/channel/${id}/status`, { status })),
};
