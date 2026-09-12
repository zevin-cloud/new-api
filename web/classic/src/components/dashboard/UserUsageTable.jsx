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
  Table,
  Avatar,
  Tag,
  Button,
  Input,
  Tooltip,
} from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, ExternalLink, Filter, Trophy } from 'lucide-react';
import { IconSearch } from '@douyinfe/semi-icons';
import { renderQuota } from '../../helpers';

const RANK_BADGES = {
  1: 'bg-amber-400 text-white font-bold',
  2: 'bg-slate-300 text-slate-800 font-bold',
  3: 'bg-amber-700/80 text-white font-bold',
};

export default function UserUsageTable({
  usersData = [],
  loading = false,
  onSelectUser,
  t,
}) {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');

  // 过滤后的用户列表
  const filteredUsers = useMemo(() => {
    if (!searchText.trim()) return usersData;
    const query = searchText.toLowerCase();
    return usersData.filter(
      (u) =>
        (u.username && u.username.toLowerCase().includes(query)) ||
        (u.user_id && String(u.user_id).includes(query)) ||
        (u.group && u.group.toLowerCase().includes(query)),
    );
  }, [usersData, searchText]);

  const columns = [
    {
      title: t('排名'),
      dataIndex: 'rank',
      key: 'rank',
      width: 70,
      render: (_, __, index) => {
        const rank = index + 1;
        const badgeStyle = RANK_BADGES[rank];
        if (badgeStyle) {
          return (
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-sm ${badgeStyle}`}
            >
              {rank}
            </div>
          );
        }
        return (
          <span className='text-gray-400 dark:text-gray-500 font-mono text-sm ml-2'>{rank}</span>
        );
      },
    },
    {
      title: t('用户'),
      dataIndex: 'username',
      key: 'username',
      render: (username, record) => (
        <div className='flex items-center gap-2.5'>
          <Avatar size='small' color='blue'>
            {(username || '?').slice(0, 1).toUpperCase()}
          </Avatar>
          <div>
            <div className='flex items-center gap-1.5'>
              <span className='font-semibold text-gray-800 dark:text-gray-200 text-sm'>
                {username}
              </span>
              {record.user_id > 0 ? (
                <span className='text-[11px] text-gray-400 dark:text-gray-500 font-mono'>
                  #{record.user_id}
                </span>
              ) : null}
            </div>
            {record.group && (
              <Tag size='small' color='purple' shape='circle' className='mt-0.5'>
                {record.group}
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: t('请求次数'),
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => (a.count || 0) - (b.count || 0),
      render: (count) => (
        <span className='font-mono font-medium text-gray-700 dark:text-gray-300'>
          {Number(count || 0).toLocaleString()}
        </span>
      ),
    },
    {
      title: t('消耗 Tokens'),
      dataIndex: 'token_used',
      key: 'token_used',
      sorter: (a, b) => (a.token_used || 0) - (b.token_used || 0),
      render: (tokens) => {
        const num = Number(tokens || 0);
        let formatted = num.toLocaleString();
        if (num >= 100000000) {
          formatted = `${(num / 100000000).toFixed(2)} 亿`;
        } else if (num >= 10000) {
          formatted = `${(num / 10000).toFixed(1)} 万`;
        }
        return (
          <Tooltip content={`${num.toLocaleString()} tokens`}>
            <span className='font-mono font-semibold text-blue-600 dark:text-blue-400'>
              {formatted}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: t('消耗额度'),
      dataIndex: 'quota',
      key: 'quota',
      sorter: (a, b) => (a.quota || 0) - (b.quota || 0),
      render: (quota) => (
        <span className='font-mono font-medium text-amber-600 dark:text-amber-400'>
          {renderQuota(quota, 2)}
        </span>
      ),
    },
    {
      title: t('主要模型'),
      dataIndex: 'top_model',
      key: 'top_model',
      render: (model) =>
        model ? (
          <Tag size='small' color='violet' shape='circle'>
            {model}
          </Tag>
        ) : (
          <span className='text-gray-300 dark:text-gray-600'>--</span>
        ),
    },
    {
      title: t('操作'),
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <div className='flex items-center gap-1.5'>
          {onSelectUser && (
            <Button
              type='tertiary'
              size='small'
              icon={<Filter size={13} />}
              onClick={() => onSelectUser(record.username)}
              title={t('在看板中仅筛选此用户')}
            >
              {t('下钻')}
            </Button>
          )}
          <Button
            type='tertiary'
            size='small'
            icon={<ExternalLink size={13} />}
            onClick={() =>
              navigate(`/console/log?username=${record.username}`)
            }
            title={t('跳转至日志列表查看详情')}
          >
            {t('日志')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card
      id='user-usage-table-card'
      className='mb-4 !rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm'
      title={
        <div className='flex items-center justify-between flex-wrap gap-2'>
          <div className='flex items-center gap-2'>
            <Trophy size={18} className='text-amber-500' />
            <span className='font-semibold text-base text-gray-800 dark:text-gray-100'>
              {t('全网关用户用量排行统揽')}
            </span>
            <span className='text-xs text-gray-400 dark:text-gray-500 font-normal'>
              ({t('共')} {filteredUsers.length} {t('位用户')})
            </span>
          </div>
          <div style={{ width: 220 }}>
            <Input
              prefix={<IconSearch />}
              placeholder={t('搜索用户名称 / 用户组')}
              value={searchText}
              onChange={(val) => setSearchText(val)}
              showClear
              size='small'
              pure
            />
          </div>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <Table
        columns={columns}
        dataSource={filteredUsers}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
        }}
        loading={loading}
        rowKey={(record) => record.username}
        className='!rounded-b-2xl'
      />
    </Card>
  );
}
