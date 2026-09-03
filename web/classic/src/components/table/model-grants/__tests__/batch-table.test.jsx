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
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ModelGrantsTable from '../ModelGrantsTable';

vi.mock('../../../../helpers', () => ({
  timestamp2string: (value) => String(value),
}));

it('renders one batch as a single record with edit drawer trigger', async () => {
  const grants = [
    {
      id: 'batch_9',
      batch_id: 9,
      created_at: 10,
      grants: [
        {
          id: 1,
          subject_type: 3,
          subject_id: 2,
          subject_name: 'Alice',
          model_set_id: 4,
          model_set_name: 'Research',
          models: ['model-a'],
          expired_at: 0,
        },
        {
          id: 2,
          subject_type: 3,
          subject_id: 2,
          subject_name: 'Alice',
          model_set_id: 5,
          model_set_name: 'Custom',
          direct_models: true,
          models: ['model-b'],
          expired_at: 0,
        },
      ],
    },
  ];

  const onViewDetail = vi.fn();
  const onEdit = vi.fn();
  const onRevoke = vi.fn();

  render(
    <ModelGrantsTable
      grants={grants}
      loading={false}
      page={1}
      pageSize={10}
      total={1}
      onPageChange={vi.fn()}
      onRevoke={onRevoke}
      onViewDetail={onViewDetail}
      onEdit={onEdit}
      enableBatchDelete={true}
      selectedRowKeys={['batch_9']}
      onSelectedChange={vi.fn()}
    />
  );

  // 1 次授权仅渲染为 1 行主记录
  expect(screen.getByText('#9')).toBeInTheDocument();
  expect(screen.getByText(/Alice/)).toBeInTheDocument();
  expect(screen.getByText('Research')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '详情' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /编辑/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /撤销/ })).toBeInTheDocument();

  // 点击详情触发 onViewDetail
  fireEvent.click(screen.getByRole('button', { name: '详情' }));
  expect(onViewDetail).toHaveBeenCalledTimes(1);

  // 点击编辑触发 onEdit
  fireEvent.click(screen.getByRole('button', { name: /编辑/ }));
  expect(onEdit).toHaveBeenCalledTimes(1);
});
