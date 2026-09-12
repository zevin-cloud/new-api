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

import React, { useState, useMemo } from 'react';
import {
  Card,
  Select,
  DatePicker,
  Button,
  AutoComplete,
  Tag,
} from '@douyinfe/semi-ui';
import {
  IconSearch,
  IconRefresh,
  IconCalendar,
} from '@douyinfe/semi-icons';
import { DATE_RANGE_PRESETS } from '../../constants/console.constants';

export default function DashboardFilterBar({
  inputs,
  handleInputChange,
  handleTimePresetChange,
  activeTimePreset,
  userGroupOptions = [],
  userSuggestions = [],
  onSearchUserSuggestions,
  onSelectUserSuggestion,
  modelOptions = [],
  channelOptions = [],
  onSearch,
  onReset,
  loading,
  isAdminUser,
  t,
}) {
  const timePresets = [
    { key: 'today', label: t('今日') },
    { key: 'yesterday', label: t('昨日') },
    { key: '7d', label: t('近7天') },
    { key: '30d', label: t('近30天') },
  ];

  // 统一业务维度选择状态
  const [activeDimension, setActiveDimension] = useState(
    isAdminUser ? 'user' : 'model',
  );

  // 可用维度列表（带已填值高亮标识）
  const dimensionOptions = useMemo(() => {
    const list = [];
    if (isAdminUser) {
      list.push({
        value: 'user',
        label: t('用户'),
        hasValue: Boolean(inputs.username || inputs.user_id),
      });
      if (userGroupOptions.length > 0) {
        list.push({
          value: 'user_group',
          label: t('用户组'),
          hasValue: Boolean(inputs.user_group_id),
        });
      }
    }
    if (modelOptions.length > 0) {
      list.push({
        value: 'model',
        label: t('模型'),
        hasValue: Boolean(inputs.model_name),
      });
    }
    if (isAdminUser && channelOptions.length > 0) {
      list.push({
        value: 'channel',
        label: t('渠道'),
        hasValue: Boolean(inputs.channel),
      });
    }
    return list;
  }, [isAdminUser, userGroupOptions, modelOptions, channelOptions, inputs, t]);

  // 已生效的业务筛选标签列表
  const activeFilterTags = useMemo(() => {
    const tags = [];
    if (inputs.username) {
      tags.push({
        key: 'user',
        label: t('用户'),
        value: inputs.username,
        onClear: () => {
          handleInputChange('', 'username');
          handleInputChange('', 'user_id');
        },
      });
    } else if (inputs.user_id) {
      tags.push({
        key: 'user',
        label: t('用户ID'),
        value: `#${inputs.user_id}`,
        onClear: () => {
          handleInputChange('', 'username');
          handleInputChange('', 'user_id');
        },
      });
    }

    if (inputs.user_group_id) {
      const grp = userGroupOptions.find(
        (g) => String(g.id) === String(inputs.user_group_id),
      );
      tags.push({
        key: 'user_group',
        label: t('用户组'),
        value: grp?.name || inputs.user_group_id,
        onClear: () => handleInputChange('', 'user_group_id'),
      });
    }

    if (inputs.model_name) {
      tags.push({
        key: 'model',
        label: t('模型'),
        value: inputs.model_name,
        onClear: () => handleInputChange('', 'model_name'),
      });
    }

    if (inputs.channel) {
      const ch = channelOptions.find(
        (c) => String(c.id) === String(inputs.channel),
      );
      tags.push({
        key: 'channel',
        label: t('渠道'),
        value: ch?.name || `渠道 #${inputs.channel}`,
        onClear: () => handleInputChange('', 'channel'),
      });
    }

    return tags;
  }, [inputs, userGroupOptions, channelOptions, handleInputChange, t]);

  return (
    <Card
      className='mb-4 !rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs'
      bodyStyle={{ padding: '12px 16px' }}
    >
      <div className='flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3'>
        {/* 左侧：时间维度与快捷预设 */}
        <div className='flex items-center flex-wrap gap-2'>
          <div className='flex items-center text-xs text-gray-500 font-medium mr-1'>
            <IconCalendar className='mr-1 text-blue-500' />
            {t('时间维度')}：
          </div>

          {/* 快捷按钮胶囊 */}
          <div className='inline-flex items-center rounded-lg bg-gray-100/90 dark:bg-gray-800/90 p-0.5'>
            {timePresets.map((preset) => {
              const active = activeTimePreset === preset.key;
              return (
                <button
                  key={preset.key}
                  type='button'
                  onClick={() => handleTimePresetChange(preset.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    active
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* 标准 Semi UI 日期范围选择器：宽度加宽至 390px，保证起止秒级时间戳完整可见不截断 */}
          <DatePicker
            type='dateTimeRange'
            size='small'
            density='compact'
            showClear
            placeholder={[t('开始时间'), t('结束时间')]}
            presets={DATE_RANGE_PRESETS.map((preset) => ({
              text: t(preset.text),
              start: preset.start(),
              end: preset.end(),
            }))}
            value={[inputs.start_timestamp, inputs.end_timestamp]}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                handleInputChange(dates[0], 'start_timestamp');
                handleInputChange(dates[1], 'end_timestamp');
                handleTimePresetChange('custom');
                const start = new Date(dates[0]).getTime();
                const end = new Date(dates[1]).getTime();
                const days = Math.round((end - start) / 86400000);
                const autoGranularity =
                  days <= 1 ? 'hour' : days > 30 ? 'week' : 'day';
                handleInputChange(autoGranularity, 'data_export_default_time');
              }
            }}
            style={{ width: 390 }}
            className='!w-[390px]'
          />
        </div>

        {/* 右侧：整合在同一个复合搜索框内的多维业务筛选器与操作按钮 */}
        <div className='flex items-center flex-wrap gap-2'>
          <div className='inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 shadow-2xs transition-all focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-400'>
            {/* 维度切换下拉框 */}
            <Select
              size='small'
              value={activeDimension}
              onChange={(val) => setActiveDimension(val)}
              className='!rounded-l-md !border-0 bg-transparent'
              style={{ width: 95 }}
            >
              {dimensionOptions.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  <div className='flex items-center justify-between gap-1.5 w-full'>
                    <span>{opt.label}</span>
                    {opt.hasValue && (
                      <span
                        className='w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0'
                        title={t('已设置筛选值')}
                      />
                    )}
                  </div>
                </Select.Option>
              ))}
            </Select>

            <div className='w-[1px] h-4 bg-gray-200 dark:bg-gray-700 mx-0.5 shrink-0' />

            {/* 动态输入与下拉区域 */}
            {activeDimension === 'user' && isAdminUser && (
              <AutoComplete
                data={userSuggestions}
                value={inputs.username || ''}
                size='small'
                prefix={<IconSearch className='text-gray-400' />}
                placeholder={t('搜索用户 ID / 用户名')}
                showClear
                borderless
                onSearch={(kw) =>
                  onSearchUserSuggestions && onSearchUserSuggestions(kw)
                }
                onChange={(val) => {
                  handleInputChange(val, 'username');
                  if (!val) {
                    handleInputChange('', 'user_id');
                  }
                }}
                onSelect={(item) => {
                  if (onSelectUserSuggestion) {
                    onSelectUserSuggestion(item);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSearch();
                  }
                }}
                renderItem={(item) => {
                  const title =
                    item.value && item.value !== 'null'
                      ? item.value
                      : `用户 #${item.userId}`;
                  return (
                    <div className='flex flex-col py-0.5 px-1'>
                      <div className='flex items-center justify-between gap-2'>
                        <span className='font-medium text-gray-800 dark:text-gray-200 text-xs'>
                          {title}
                        </span>
                        <span className='text-[11px] text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/30 px-1 rounded'>
                          ID: {item.userId}
                        </span>
                      </div>
                      {item.displayName && item.displayName !== 'null' && (
                        <span className='text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5'>
                          {item.displayName}
                        </span>
                      )}
                    </div>
                  );
                }}
                style={{ width: 210 }}
              />
            )}

            {activeDimension === 'user_group' && isAdminUser && (
              <Select
                size='small'
                placeholder={t('选择用户组')}
                value={inputs.user_group_id || ''}
                onChange={(val) => handleInputChange(val, 'user_group_id')}
                showClear
                borderless
                style={{ width: 210 }}
              >
                <Select.Option value='' label={t('全部用户组')}>
                  <span className='text-gray-500 dark:text-gray-400'>
                    {t('全部用户组')}
                  </span>
                </Select.Option>
                {userGroupOptions.map((group) => (
                  <Select.Option
                    key={group.id}
                    value={String(group.id)}
                    label={group.name}
                  >
                    <div className='flex items-center justify-between gap-2 py-0.5 w-full'>
                      <span className='font-medium text-gray-800 dark:text-gray-200 text-xs'>
                        {group.name}
                      </span>
                      {group.description && (
                        <span
                          className='text-[11px] text-gray-400 dark:text-gray-500 max-w-[90px] truncate'
                          title={group.description}
                        >
                          {group.description}
                        </span>
                      )}
                    </div>
                  </Select.Option>
                ))}
              </Select>
            )}

            {activeDimension === 'model' && (
              <Select
                size='small'
                placeholder={t('选择模型')}
                value={inputs.model_name || ''}
                onChange={(val) => handleInputChange(val, 'model_name')}
                showClear
                filter
                borderless
                style={{ width: 210 }}
              >
                <Select.Option value=''>{t('全部模型')}</Select.Option>
                {modelOptions.map((mod) => (
                  <Select.Option key={mod} value={mod}>
                    {mod}
                  </Select.Option>
                ))}
              </Select>
            )}

            {activeDimension === 'channel' && isAdminUser && (
              <Select
                size='small'
                placeholder={t('选择渠道')}
                value={inputs.channel || ''}
                onChange={(val) => handleInputChange(val, 'channel')}
                showClear
                filter
                borderless
                style={{ width: 210 }}
              >
                <Select.Option value=''>{t('全部渠道')}</Select.Option>
                {channelOptions.map((ch) => (
                  <Select.Option key={ch.id} value={String(ch.id)}>
                    {ch.name || `渠道 #${ch.id}`}
                  </Select.Option>
                ))}
              </Select>
            )}
          </div>

          {/* 操作按钮 */}
          <Button
            type='primary'
            theme='solid'
            size='small'
            icon={<IconSearch />}
            onClick={onSearch}
            loading={loading}
          >
            {t('查询')}
          </Button>
          <Button
            type='tertiary'
            size='small'
            icon={<IconRefresh />}
            onClick={onReset}
          >
            {t('重置')}
          </Button>
        </div>
      </div>

      {/* 已生效的多维过滤标签胶囊 */}
      {activeFilterTags.length > 0 && (
        <div className='flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs'>
          <span className='text-gray-400 font-medium mr-1'>
            {t('已选过滤条件')}:
          </span>
          {activeFilterTags.map((tag) => (
            <Tag
              key={tag.key}
              size='small'
              color='blue'
              closable
              onClose={tag.onClear}
              className='!rounded-md'
            >
              {tag.label}: {tag.value}
            </Tag>
          ))}
          <button
            type='button'
            onClick={onReset}
            className='text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 underline ml-1 cursor-pointer'
          >
            {t('清空条件')}
          </button>
        </div>
      )}
    </Card>
  );
}
