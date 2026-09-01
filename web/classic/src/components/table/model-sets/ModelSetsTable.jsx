/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Table, Button, Space, Tag, Popconfirm, Popover } from '@douyinfe/semi-ui';
import { IconEdit, IconDelete, IconUserGroup, IconList } from '@douyinfe/semi-icons';
import { timestamp2string } from '../../../helpers';

const ModelSetsTable = ({
  sets,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onEdit,
  onManageSubjects,
  onDelete,
  t,
}) => {
  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: t('模型集名称'),
      dataIndex: 'name',
      render: (v, r) => (
        <div>
          <div className='font-medium'>{v}</div>
          {r.description && <div className='text-xs text-gray-500'>{r.description}</div>}
        </div>
      ),
    },
    {
      title: t('包含模型'),
      dataIndex: 'models',
      render: (models) => {
        if (!models || models.length === 0) {
          return <Tag color='grey'>{t('0 个模型')}</Tag>;
        }
        return (
          <Popover
            content={
              <div className='max-w-md max-h-60 overflow-y-auto p-2 flex flex-wrap gap-1'>
                {models.map((m) => (
                  <Tag key={m} color='blue' size='small'>
                    {m}
                  </Tag>
                ))}
              </div>
            }
            trigger='hover'
          >
            <Tag color='blue' className='cursor-pointer'>
              {models.length} {t('个模型 (查看)')}
            </Tag>
          </Popover>
        );
      },
    },
    {
      title: t('已授权主体'),
      dataIndex: 'grant_count',
      width: 120,
      render: (v) => <Tag color='cyan'>{v || 0} {t('个主体')}</Tag>,
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
      width: 240,
      render: (_, record) => (
        <Space>
          <Button
            theme='light'
            type='warning'
            size='small'
            icon={<IconUserGroup />}
            onClick={() => onManageSubjects(record)}
          >
            {t('授权主体')}
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
            title={t('确认删除模型集')}
            content={t('确定要删除模型集 {{name}} 吗？若存在生效中的授权将无法直接删除。', { name: record.name })}
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
      columns={columns}
      dataSource={sets}
      loading={loading}
      pagination={{
        currentPage: page,
        pageSize: pageSize,
        total: total,
        onPageChange: onPageChange,
      }}
      size='middle'
    />
  );
};

export default ModelSetsTable;
