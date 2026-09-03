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

import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      '@douyinfe/semi-ui': path.resolve(
        root,
        '../node_modules/@douyinfe/semi-ui/lib/es/index.js'
      ),
      'date-fns-tz': path.resolve(
        root,
        '../node_modules/date-fns-tz/esm/index.js'
      ),
      'date-fns': path.resolve(
        root,
        '../node_modules/@douyinfe/semi-ui/node_modules/date-fns'
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    server: { deps: { inline: [/semi-/, /date-fns/] } },
    clearMocks: true,
    restoreMocks: true,
    include: [
      'src/**/__tests__/*.test.jsx',
      'src/services/__tests__/*.test.js',
    ],
  },
});
