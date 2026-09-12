/*
Copyright (C) 2025-2026 QuantumNous

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
import { Button, Tag } from '@douyinfe/semi-ui';
import { RefreshCw, Calendar } from 'lucide-react';

const DashboardHeader = ({
  getGreeting,
  greetingVisible,
  refresh,
  loading,
  currentDate = new Date().toISOString().slice(0, 10),
  isAdminUser,
  t,
}) => {
  return (
    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4'>
      <div>
        <div className='flex items-center gap-2 mb-1'>
          <Tag color='blue' shape='circle' size='large'>
            <Calendar size={12} className='mr-1 inline' />
            {currentDate}
          </Tag>
          <h2 className='text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight'>
            {isAdminUser ? t('AI 网关运营大盘') : t('数据看板')}
          </h2>
        </div>
        <p className='text-xs text-gray-500 dark:text-gray-400'>
          {isAdminUser
            ? t('全平台调用统览 · 3x3运营质量与私有化价值矩阵')
            : getGreeting}
        </p>
      </div>

      <div className='flex items-center gap-2.5'>
        <Button
          type='tertiary'
          icon={<RefreshCw size={15} />}
          onClick={refresh}
          loading={loading}
          className='!rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200'
          title={t('刷新数据')}
        />
      </div>
    </div>
  );
};

export default DashboardHeader;
