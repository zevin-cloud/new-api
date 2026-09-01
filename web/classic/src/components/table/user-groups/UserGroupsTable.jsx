/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Table, Button, Space, Tag, Popconfirm, Dropdown } from '@douyinfe/semi-ui';
import { IconMore, IconEdit, IconDelete, IconUserGroup, IconLock } from '@douyinfe/semi-icons';
import { timestamp2string } from '../../../helpers';

const UserGroupsTable = ({
  groups,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onManageMembers,
  onDelete,
  t,
}) => {
  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: t('用户组名称'),
      dataIndex: 'name',
      render: (v, r) => (
        <div>
          <div className='font-medium'>{v}</div>
          {r.description && <div className='text-xs text-gray-500'>{r.description}</div>}
        </div>
      ),
    },
    {
      title: t('成员数'),
      dataIndex: 'member_count',
      width: 100,
      render: (v) => <Tag color='cyan'>{v || 0} {t('人')}</Tag>,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 90,
      render: (v) => (
        v === 1 ? <Tag color='green'>{t('启用')}</Tag> : <Tag color='grey'>{t('禁用')}</Tag>
      ),
    },
    {
      title: t('创建时间'),
      dataIndex: 'created_at',
      width: 170,
      render: (v) => timestamp2string(v),
    },
    {
      title: t('操作'),
      key: 'op',
      fixed: 'right',
      width: 190,
      render: (_, record) => (
        <Space>
          <Button
            theme='light'
            type='primary'
            size='small'
            icon={<IconUserGroup />}
            onClick={() => onManageMembers(record)}
          >
            {t('成员')}
          </Button>

          <Button
            theme='light'
            type='tertiary'
            size='small'
            icon={<IconEdit />}
            onClick={() => onEdit(record)}
          >
            {t('编辑')}
          </Button>

          <Popconfirm
            title={t('确认删除用户组')}
            content={t('确定删除用户组 {{name}} 吗？若存在生效中的模型集授权将无法直接删除。', { name: record?.name })}
            onConfirm={() => onDelete(record)}
          >
            <Button
              theme='borderless'
              type='danger'
              size='small'
              icon={<IconDelete />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Table
      rowKey='id'
      columns={columns}
      dataSource={Array.isArray(groups) ? groups : []}
      loading={loading}
      pagination={{
        currentPage: page,
        pageSize: pageSize,
        total: total || 0,
        onPageChange: onPageChange,
      }}
      size='middle'
    />
  );
};

export default UserGroupsTable;
