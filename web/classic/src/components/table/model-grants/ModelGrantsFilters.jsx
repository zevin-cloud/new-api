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
import { Button, Select, Input } from '@douyinfe/semi-ui';
import { IconSearch, IconPlus, IconRefresh } from '@douyinfe/semi-icons';

const ModelGrantsFilters = ({
  onOpenCreate,
  onOpenInspect,
  onRefresh,
  filters,
  onFilterChange,
  modelSets = [],
}) => {
  const { t } = useTranslation();

  return (
    <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
      {/* 左侧：主操作按钮组 (对标渠道管理添加/刷新) */}
      <div className='flex items-center gap-2 w-full md:w-auto order-2 md:order-1'>
        <Button
          size='small'
          theme='solid'
          type='primary'
          icon={<IconPlus />}
          className='w-full md:w-auto'
          onClick={onOpenCreate}
        >
          {t('新建授权')}
        </Button>

        <Button
          size='small'
          type='tertiary'
          icon={<IconSearch />}
          className='w-full md:w-auto'
          onClick={onOpenInspect}
        >
          {t('权限诊断')}
        </Button>

        <Button
          size='small'
          type='tertiary'
          icon={<IconRefresh />}
          className='w-full md:w-auto'
          onClick={onRefresh}
        >
          {t('刷新')}
        </Button>
      </div>

      {/* 右侧：搜索表单区域 */}
      <div className='flex flex-col md:flex-row items-center gap-2 w-full md:w-auto order-1 md:order-2'>
        <div className='w-full md:w-64'>
          <Input
            size='small'
            prefix={<IconSearch />}
            placeholder={t('搜索主体名称或模型集...')}
            value={filters.keyword || ''}
            onChange={(v) => onFilterChange('keyword', v)}
            showClear
          />
        </div>

        <Select
          size='small'
          placeholder={t('全部主体类型')}
          value={filters.subject_type || 0}
          onChange={(v) => onFilterChange('subject_type', v)}
          style={{ width: 130 }}
        >
          <Select.Option value={0}>{t('全部主体类型')}</Select.Option>
          <Select.Option value={1}>{t('部门')}</Select.Option>
          <Select.Option value={2}>{t('用户组')}</Select.Option>
          <Select.Option value={3}>{t('个人用户')}</Select.Option>
        </Select>

        <Select
          size='small'
          placeholder={t('全部模型集')}
          value={filters.model_set_id || 0}
          onChange={(v) => onFilterChange('model_set_id', v)}
          style={{ width: 150 }}
          filter
        >
          <Select.Option value={0}>{t('全部模型集')}</Select.Option>
          {(modelSets || []).filter(Boolean).map((s) => (
            <Select.Option key={s.id} value={s.id}>
              {s.name}
            </Select.Option>
          ))}
        </Select>
      </div>
    </div>
  );
};

export default ModelGrantsFilters;
