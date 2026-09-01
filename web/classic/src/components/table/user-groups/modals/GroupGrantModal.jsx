/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Select, Space, Tag, Typography, Popconfirm, InputNumber, Divider } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { API, showError, showSuccess, timestamp2string } from '../../../../helpers';

const { Text } = Typography;

const GroupGrantModal = ({ visible, group, onClose, t }) => {
  const [grants, setGrants] = useState([]);
  const [allModelSets, setAllModelSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState(null);
  const [durationDays, setDurationDays] = useState(0);

  useEffect(() => {
    if (visible && group) {
      loadGroupDetail();
      loadModelSets();
    }
  }, [visible, group]);

  const loadGroupDetail = async () => {
    if (!group) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/user-group/${group.id}`);
      if (res.data?.success) {
        setGrants(res.data.data.grants || []);
      }
    } catch (e) {
      showError('获取授权详情失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadModelSets = async () => {
    try {
      const res = await API.get('/api/model-set?page=1&page_size=100');
      if (res.data?.success) {
        setAllModelSets(res.data.data.items || []);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleGrant = async () => {
    if (!selectedSetId) {
      showError(t('请选择要授权的模型集'));
      return;
    }
    try {
      const res = await API.post('/api/model-grant', {
        subject_type: 2, // UserGroup
        subject_id: group.id,
        model_set_id: selectedSetId,
        duration_days: durationDays,
      });
      if (res.data?.success) {
        showSuccess(t('模型集授权成功'));
        setSelectedSetId(null);
        setDurationDays(0);
        loadGroupDetail();
      } else {
        showError(res.data?.message || '授权失败');
      }
    } catch (e) {
      showError('授权失败: ' + e.message);
    }
  };

  const handleRevoke = async (grantId) => {
    try {
      const res = await API.delete(`/api/model-grant/${grantId}`);
      if (res.data?.success) {
        showSuccess(t('撤销授权成功'));
        loadGroupDetail();
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
      title: t('模型集名称'),
      dataIndex: 'model_set_name',
      render: (v) => <Tag color='blue'>{v}</Tag>,
    },
    {
      title: t('有效期'),
      dataIndex: 'expired_at',
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
      render: (v) => timestamp2string(v),
    },
    {
      title: t('操作'),
      key: 'op',
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title={t('确认撤销授权')}
          content={t('确定要撤销对模型集 {{name}} 的授权吗？', { name: record.model_set_name })}
          onConfirm={() => handleRevoke(record.id)}
        >
          <Button size='small' type='danger' theme='borderless'>
            {t('撤销')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Modal
      title={t('模型集授权管理 - {{name}}', { name: group?.name })}
      visible={visible}
      onCancel={onClose}
      width={780}
      footer={
        <Button theme='light' onClick={onClose}>
          {t('关闭')}
        </Button>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap gap-2 items-center p-3 bg-[var(--semi-color-fill-0)] rounded-lg'>
          <Select
            placeholder={t('选择要授权的模型集')}
            value={selectedSetId}
            onChange={(v) => setSelectedSetId(v)}
            style={{ width: 220 }}
          >
            {allModelSets.map((s) => (
              <Select.Option key={s.id} value={s.id}>
                {s.name} ({s.model_count || 0} 模型)
              </Select.Option>
            ))}
          </Select>

          <InputNumber
            placeholder={t('有效天数 (0 为永久)')}
            value={durationDays}
            onChange={(v) => setDurationDays(v)}
            min={0}
            style={{ width: 180 }}
          />

          <Button
            theme='solid'
            type='primary'
            icon={<IconPlus />}
            onClick={handleGrant}
            disabled={!selectedSetId}
          >
            {t('新增授权')}
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={grants}
          loading={loading}
          pagination={false}
          size='small'
        />
      </div>
    </Modal>
  );
};

export default GroupGrantModal;
