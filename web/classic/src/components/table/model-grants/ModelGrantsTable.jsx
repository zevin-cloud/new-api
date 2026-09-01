/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import { Table, Tag, Button, Popconfirm, Typography, Popover } from '@douyinfe/semi-ui';
import { timestamp2string } from '../../../helpers';

const { Text } = Typography;

const ModelGrantsTable = ({
  grants,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onRevoke,
  t,
}) => {
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: t('主体类型'),
      dataIndex: 'subject_type',
      width: 100,
      render: (v) => {
        if (v === 1) return <Tag color='cyan'>{t('部门')}</Tag>;
        if (v === 2) return <Tag color='violet'>{t('用户组')}</Tag>;
        if (v === 3) return <Tag color='blue'>{t('个人用户')}</Tag>;
        return <Tag color='grey'>{v}</Tag>;
      },
    },
    {
      title: t('主体名称'),
      dataIndex: 'subject_name',
      width: 160,
      render: (v) => <span className='font-medium'>{v || '-'}</span>,
    },
    {
      title: t('授权模型集'),
      dataIndex: 'model_set_name',
      width: 160,
      render: (v) => <Tag color='blue'>{v || '-'}</Tag>,
    },
    {
      title: t('包含模型'),
      dataIndex: 'models',
      render: (models) => {
        if (!models || models.length === 0) {
          return <span className='text-[var(--semi-color-text-2)]'>{t('无模型')}</span>;
        }
        const visibleModels = models.slice(0, 3);
        const remainingCount = models.length - 3;
        return (
          <div className='flex flex-wrap items-center gap-1'>
            {visibleModels.map((m) => (
              <Tag key={m} size='small' color='grey'>
                {m}
              </Tag>
            ))}
            {remainingCount > 0 && (
              <Popover
                content={
                  <div className='flex flex-wrap gap-1 max-w-[280px] p-2'>
                    {models.map((m) => (
                      <Tag key={m} size='small' color='grey'>
                        {m}
                      </Tag>
                    ))}
                  </div>
                }
              >
                <Tag size='small' color='light-blue' className='cursor-pointer'>
                  +{remainingCount}
                </Tag>
              </Popover>
            )}
          </div>
        );
      },
    },
    {
      title: t('有效期'),
      dataIndex: 'expired_at',
      width: 170,
      render: (v) => {
        if (!v || v === 0) return <Tag color='green'>{t('永久有效')}</Tag>;
        const isExpired = v < Math.floor(Date.now() / 1000);
        return (
          <Tag color={isExpired ? 'red' : 'orange'}>
            {timestamp2string(v)} {isExpired ? `(${t('已过期')})` : ''}
          </Tag>
        );
      },
    },
    {
      title: t('授权时间'),
      dataIndex: 'created_at',
      width: 160,
      render: (v) => timestamp2string(v),
    },
    {
      title: t('操作'),
      key: 'op',
      width: 90,
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm
          title={t('确认撤销授权')}
          content={t('确定要撤销主体 {{subject}} 对模型集 {{set}} 的授权吗？', {
            subject: record.subject_name || '',
            set: record.model_set_name || '',
          })}
          onConfirm={() => onRevoke(record.id)}
        >
          <Button size='small' type='danger' theme='borderless'>
            {t('撤销')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={grants}
      loading={loading}
      pagination={{
        currentPage: page,
        pageSize: pageSize,
        total: total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
        onPageChange: (newPage) => onPageChange(newPage, pageSize),
        onPageSizeChange: (newPageSize) => onPageChange(1, newPageSize),
      }}
      size='small'
      rowKey='id'
    />
  );
};

export default ModelGrantsTable;
