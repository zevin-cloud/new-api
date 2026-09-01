/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Tag, Space, Input, Popconfirm, InputNumber, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess, timestamp2string } from '../../../../helpers';

const { Text } = Typography;

const AdminRequestsModal = ({ visible, onClose, t }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [commentMap, setCommentMap] = useState({});
  const [durationMap, setDurationMap] = useState({});

  const loadRequests = async (p = 1) => {
    setLoading(true);
    try {
      const res = await API.get(`/api/user/model-access-request?page=${p}&page_size=10&status=1`);
      if (res.data?.success) {
        setRequests(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page || 1);
      } else {
        showError(res.data?.message || '获取待审批记录失败');
      }
    } catch (e) {
      showError('获取待审批记录失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadRequests(1);
    }
  }, [visible]);

  const handleApprove = async (id) => {
    try {
      const res = await API.post(`/api/user/model-access-request/${id}/approve`, {
        comment: commentMap[id] || '',
        duration_days: durationMap[id] || 0,
      });
      if (res.data?.success) {
        showSuccess(t('审批通过成功'));
        loadRequests(page);
      } else {
        showError(res.data?.message || '审批失败');
      }
    } catch (e) {
      showError('审批失败: ' + e.message);
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await API.post(`/api/user/model-access-request/${id}/reject`, {
        comment: commentMap[id] || '',
      });
      if (res.data?.success) {
        showSuccess(t('已拒绝申请'));
        loadRequests(page);
      } else {
        showError(res.data?.message || '拒绝失败');
      }
    } catch (e) {
      showError('拒绝失败: ' + e.message);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: t('申请人'),
      dataIndex: 'user_name',
      render: (v, r) => (
        <div>
          <span className='font-medium'>{v}</span>
          {r.dept_name && <div className='text-xs text-gray-500'>[{r.dept_name}]</div>}
        </div>
      ),
    },
    {
      title: t('申请目标'),
      dataIndex: 'target_name',
      render: (v, r) => (
        <Space>
          <Tag color={r.target_type === 1 ? 'blue' : 'violet'}>
            {r.target_type === 1 ? t('模型') : t('模型集')}
          </Tag>
          <span className='font-medium'>{v}</span>
        </Space>
      ),
    },
    {
      title: t('申请理由'),
      dataIndex: 'reason',
      render: (v) => <span className='text-xs text-gray-700'>{v}</span>,
    },
    {
      title: t('期望期限'),
      dataIndex: 'expected_duration_days',
      width: 90,
      render: (v) => v > 0 ? `${v} ${t('天')}` : t('永久'),
    },
    {
      title: t('授权天数'),
      key: 'duration_input',
      width: 110,
      render: (_, record) => (
        <InputNumber
          size='small'
          placeholder={t('天数')}
          value={durationMap[record.id] !== undefined ? durationMap[record.id] : record.expected_duration_days}
          onChange={(val) => setDurationMap((prev) => ({ ...prev, [record.id]: val }))}
          min={0}
        />
      ),
    },
    {
      title: t('审批备注'),
      key: 'comment_input',
      width: 140,
      render: (_, record) => (
        <Input
          size='small'
          placeholder={t('审批备注')}
          value={commentMap[record.id] || ''}
          onChange={(val) => setCommentMap((prev) => ({ ...prev, [record.id]: val }))}
        />
      ),
    },
    {
      title: t('操作'),
      key: 'op',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            size='small'
            theme='solid'
            type='primary'
            onClick={() => handleApprove(record.id)}
          >
            {t('通过')}
          </Button>
          <Popconfirm
            title={t('确认拒绝')}
            content={t('确定拒绝该申请吗？')}
            onConfirm={() => handleReject(record.id)}
          >
            <Button size='small' theme='light' type='danger'>
              {t('拒绝')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Modal
      title={t('模型访问权限审批 (待审批 {{total}} 条)', { total })}
      visible={visible}
      onCancel={onClose}
      width={960}
      footer={
        <Button theme='light' onClick={onClose}>
          {t('关闭')}
        </Button>
      }
    >
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
        size='small'
      />
    </Modal>
  );
};

export default AdminRequestsModal;
