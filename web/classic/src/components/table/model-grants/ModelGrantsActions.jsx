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
import { useTranslation } from 'react-i18next';
import {
  Button,
  Modal,
  Switch,
  Typography,
  Select,
} from '@douyinfe/semi-ui';

const ModelGrantsActions = ({
  enableBatchDelete,
  setEnableBatchDelete,
  selectedKeys = [],
  onBatchRevoke,
  statusFilter,
  setStatusFilter,
}) => {
  const { t } = useTranslation();
  const selectedCount = selectedKeys.length;

  return (
    <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
      {/* 左侧：批量操作按钮区 */}
      <div className='flex flex-wrap items-center gap-2 w-full md:w-auto order-2 md:order-1'>
        <Button
          size='small'
          disabled={!enableBatchDelete || selectedCount === 0}
          type='danger'
          className='w-full md:w-auto'
          onClick={() => {
            Modal.confirm({
              title: t('确定是否要删除所选授权？'),
              content: t('将同时撤销所选授权包含的全部模型访问权限，此修改不可逆。'),
              onOk: () => onBatchRevoke?.(selectedKeys),
            });
          }}
        >
          {selectedCount > 0
            ? t('删除所选授权 ({{count}})', { count: selectedCount })
            : t('删除所选授权')}
        </Button>
      </div>

      {/* 右侧：设置开关与状态筛选区 (参考渠道管理) */}
      <div className='flex flex-col md:flex-row items-start md:items-center gap-3 w-full md:w-auto order-1 md:order-2'>
        <div className='flex items-center justify-between w-full md:w-auto'>
          <Typography.Text strong className='mr-2 text-xs text-gray-600 dark:text-gray-300'>
            {t('开启批量操作')}
          </Typography.Text>
          <Switch
            size='small'
            checked={enableBatchDelete}
            onChange={(v) => setEnableBatchDelete(v)}
          />
        </div>

        <div className='flex items-center justify-between w-full md:w-auto'>
          <Typography.Text strong className='mr-2 text-xs text-gray-600 dark:text-gray-300'>
            {t('状态筛选')}
          </Typography.Text>
          <Select
            size='small'
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 110 }}
          >
            <Select.Option value={0}>{t('全部')}</Select.Option>
            <Select.Option value={1}>{t('有效中')}</Select.Option>
            <Select.Option value={2}>{t('已过期')}</Select.Option>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default ModelGrantsActions;
