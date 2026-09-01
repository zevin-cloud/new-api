/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Popconfirm, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess, timestamp2string } from '../../../../helpers';

const { Text } = Typography;

const MyRequestsView = ({ t }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadRequests = async (p = 1) => {
    setLoading(true);
    try {
      const res = await API.get(`/api/user/model-access-request/my?page=${p}&page_size=10`);
      if (res.data?.success) {
        setRequests(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page || 1);
      } else {
        showError(res.data?.message || '获取申请记录失败');
      }
    } catch (e) {
      showError('获取申请记录失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests(1);
  }, []);

  const handleCancel = async (id) => {
    try {
      const res = await API.delete(`/api/user/model-access-request/${id}`);
      if (res.data?.success) {
        showSuccess(t('撤销申请成功'));
        loadRequests(page);
      } else {
        showError(res.data?.message || '撤销失败');
      }
    } catch (e) {
      showError('撤销失败: ' + e.message);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: t('申请目标'),
      dataIndex: 'target_name',
      render: (v, r) => (
        <Space>
          <Tag color={r.target_type === 1 ? 'blue' : 'violet'}>
            {r.target_type === 1 ? t('单个模型') : t('模型集')}
          </Tag>
          <span className='font-medium'>{v}</span>
        </Space>
      ),
    },
    {
      title: t('申请理由'),
      dataIndex: 'reason',
      render: (v) => <span className='text-sm text-gray-700'>{v}</span>,
    },
    {
      title: t('期望期限'),
      dataIndex: 'expected_duration_days',
      width: 100,
      render: (v) => v > 0 ? `${v} ${t('天')}` : t('永久有效'),
    },
    {
      title: t('审批状态'),
      dataIndex: 'status',
      width: 100,
      render: (v) => {
        if (v === 1) return <Tag color='orange'>{t('待审批')}</Tag>;
        if (v === 2) return <Tag color='green'>{t('已通过')}</Tag>;
        if (v === 3) return <Tag color='red'>{t('已拒绝')}</Tag>;
        if (v === 4) return <Tag color='grey'>{t('已撤销')}</Tag>;
        return <Tag color='grey'>{v}</Tag>;
      },
    },
    {
      title: t('审批备注'),
      dataIndex: 'review_comment',
      render: (v) => v ? <span className='text-xs text-gray-500'>{v}</span> : '-',
    },
    {
      title: t('申请时间'),
      dataIndex: 'created_at',
      width: 160,
      render: (v) => timestamp2string(v),
    },
    {
      title: t('操作'),
      key: 'op',
      width: 100,
      render: (_, record) => {
        if (record.status === 1) {
          return (
            <Popconfirm
              title={t('确认撤销')}
              content={t('确定撤销该申请吗？')}
              onConfirm={() => handleCancel(record.id)}
            >
              <Button size='small' type='danger' theme='borderless'>
                {t('撤销申请')}
              </Button>
            </Popconfirm>
          );
        }
        return '-';
      },
    },
  ];

  return (
    <div className='p-4 bg-white rounded-lg'>
      <div className='flex justify-between items-center mb-4'>
        <Text strong className='text-base'>{t('我的模型权限申请列表')}</Text>
        <Button size='small' theme='light' onClick={() => loadRequests(page)}>
          {t('刷新')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={requests}
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize: 10,
          total: total,
          onPageChange: (p) => loadRequests(p),
        }}
        size='middle'
      />
    </div>
  );
};

export default MyRequestsView;
