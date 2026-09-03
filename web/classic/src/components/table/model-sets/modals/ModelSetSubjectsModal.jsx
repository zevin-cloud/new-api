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

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Table,
  Button,
  Select,
  Space,
  Tag,
  Typography,
  Popconfirm,
  InputNumber,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
} from '../../../../helpers';

import { loadGrantSubjects } from '../../../../services/modelGrants';

const { Text } = Typography;

const ModelSetSubjectsModal = ({ visible, modelSet, onClose }) => {
  const { t } = useTranslation();
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subjectType, setSubjectType] = useState(2); // 1: dept, 2: group, 3: user
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [targetOptions, setTargetOptions] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [durationDays, setDurationDays] = useState(0);

  useEffect(() => {
    if (visible && modelSet) {
      loadGrants();
    }
  }, [visible, modelSet]);

  useEffect(() => {
    if (visible) {
      const controller = new AbortController();
      loadSubjectOptions(subjectType, controller.signal);
      return () => controller.abort();
    }
  }, [visible, subjectType]);

  const loadGrants = async () => {
    if (!modelSet) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/model-set/${modelSet.id}`);
      if (res.data?.success) {
        setGrants(res.data.data.grants || []);
      } else {
        showError(res.data?.message || '获取授权主体失败');
      }
    } catch (e) {
      showError('获取授权主体失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSubjectOptions = async (type, signal) => {
    setSelectedSubjectId(null);
    setTargetOptions([]);
    setLoadingSubjects(true);
    try {
      const subjects = await loadGrantSubjects(type, signal);
      if (signal.aborted) return;
      setTargetOptions(
        subjects
          .filter((subject) => subject.status === 1)
          .map((subject) => ({
            label:
              type === 3
                ? (subject.display_name || subject.username) +
                  ' (@' +
                  subject.username +
                  ')'
                : subject.name,
            value: subject.id,
          }))
      );
    } catch (error) {
      if (!signal.aborted)
        showError(error.message || t('Unable to load authorization data'));
    } finally {
      if (!signal.aborted) setLoadingSubjects(false);
    }
  };

  const handleGrant = async () => {
    if (!selectedSubjectId) {
      showError(t('请选择授权目标'));
      return;
    }
    try {
      const res = await API.post('/api/model-grant', {
        subject_type: subjectType,
        subject_id: selectedSubjectId,
        model_set_id: modelSet.id,
        duration_days: durationDays,
      });
      if (res.data?.success) {
        showSuccess(t('添加授权主体成功'));
        setSelectedSubjectId(null);
        setDurationDays(0);
        loadGrants();
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
        loadGrants();
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
      render: (v) => <span className='font-medium'>{v}</span>,
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
          title={t('确认撤销')}
          content={t('确定要撤销对 {{name}} 的授权吗？', {
            name: record.subject_name,
          })}
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
      title={t('授权主体管理 - {{name}}', { name: modelSet?.name })}
      visible={visible}
      onCancel={onClose}
      width={800}
      footer={
        <Button theme='light' onClick={onClose}>
          {t('关闭')}
        </Button>
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap gap-2 items-center p-3 bg-[var(--semi-color-fill-0)] rounded-lg'>
          <Select
            value={subjectType}
            onChange={(v) => setSubjectType(v)}
            style={{ width: 120 }}
          >
            <Select.Option value={1}>{t('部门')}</Select.Option>
            <Select.Option value={2}>{t('用户组')}</Select.Option>
            <Select.Option value={3}>{t('个人用户')}</Select.Option>
          </Select>

          <Select
            placeholder={t('选择授权目标')}
            value={selectedSubjectId}
            onChange={(v) => setSelectedSubjectId(v)}
            optionList={targetOptions}
            loading={loadingSubjects}
            filter
            style={{ width: 220 }}
          />

          <InputNumber
            placeholder={t('有效天数 (0 永久)')}
            value={durationDays}
            onChange={(v) => setDurationDays(v)}
            min={0}
            style={{ width: 140 }}
          />

          <Button
            theme='solid'
            type='primary'
            icon={<IconPlus />}
            onClick={handleGrant}
            disabled={loadingSubjects || !selectedSubjectId}
          >
            {t('授权此主体')}
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

export default ModelSetSubjectsModal;
