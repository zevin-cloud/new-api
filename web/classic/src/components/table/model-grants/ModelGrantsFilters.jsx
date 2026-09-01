/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Select, Input } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';

const ModelGrantsFilters = ({
  filters,
  onFilterChange,
  modelSets = [],
  t,
}) => {
  return (
    <div className='flex flex-wrap gap-2 items-center'>
      {/* 1. 主体类型筛选 */}
      <Select
        size='small'
        className='!rounded-lg'
        placeholder={t('主体类型')}
        value={filters.subject_type || 0}
        onChange={(v) => onFilterChange('subject_type', v)}
        style={{ width: 130 }}
      >
        <Select.Option value={0}>{t('全部主体类型')}</Select.Option>
        <Select.Option value={1}>{t('部门')}</Select.Option>
        <Select.Option value={2}>{t('用户组')}</Select.Option>
        <Select.Option value={3}>{t('个人用户')}</Select.Option>
      </Select>

      {/* 2. 模型集筛选 */}
      <Select
        size='small'
        className='!rounded-lg'
        placeholder={t('全部模型集')}
        value={filters.model_set_id || 0}
        onChange={(v) => onFilterChange('model_set_id', v)}
        style={{ width: 160 }}
        filter
      >
        <Select.Option value={0}>{t('全部模型集')}</Select.Option>
        {modelSets.map((s) => (
          <Select.Option key={s.id} value={s.id}>
            {s.name}
          </Select.Option>
        ))}
      </Select>

      {/* 3. 状态筛选 */}
      <Select
        size='small'
        className='!rounded-lg'
        placeholder={t('授权状态')}
        value={filters.status || 0}
        onChange={(v) => onFilterChange('status', v)}
        style={{ width: 120 }}
      >
        <Select.Option value={0}>{t('全部状态')}</Select.Option>
        <Select.Option value={1}>{t('生效中')}</Select.Option>
        <Select.Option value={2}>{t('已过期')}</Select.Option>
      </Select>

      {/* 4. 关键字搜索 */}
      <Input
        size='small'
        className='!rounded-lg'
        prefix={<IconSearch />}
        placeholder={t('搜索主体名称或模型集...')}
        value={filters.keyword || ''}
        onChange={(v) => onFilterChange('keyword', v)}
        showClear
        style={{ width: 200 }}
      />
    </div>
  );
};

export default ModelGrantsFilters;
