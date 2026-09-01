/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Form, Select, Radio, RadioGroup } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';

const BatchGroupModal = ({ visible, selectedUserIds, onClose, onSuccess, t }) => {
  const formApiRef = useRef(null);
  const [userGroups, setUserGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadUserGroups();
    }
  }, [visible]);

  const loadUserGroups = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/user-group?page=1&page_size=100');
      if (res.data?.success) {
        setUserGroups(res.data.data.items || []);
      }
    } catch (e) {
      showError('加载用户组列表失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await formApiRef.current.validate();
      const res = await API.post('/api/user-group/batch', {
        user_ids: selectedUserIds,
        group_id: Number(values.group_id),
        action: values.action,
      });
      if (res.data?.success) {
        showSuccess(t('批量操作用户组成功'));
        onSuccess();
      } else {
        showError(res.data?.message || '操作失败');
      }
    } catch (e) {
      // validation error
    }
  };

  return (
    <Modal
      title={t('批量修改用户组 (已选 {{count}} 人)', { count: selectedUserIds.length })}
      visible={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnClose
    >
      <Form getFormApi={(api) => (formApiRef.current = api)}>
        <Form.RadioGroup
          field='action'
          label={t('操作类型')}
          initValue='add'
          rules={[{ required: true }]}
        >
          <Radio value='add'>{t('加入目标用户组')}</Radio>
          <Radio value='remove'>{t('移出目标用户组')}</Radio>
        </Form.RadioGroup>

        <Form.Select
          field='group_id'
          label={t('目标用户组')}
          placeholder={t('请选择用户组')}
          loading={loading}
          rules={[{ required: true, message: t('请选择用户组') }]}
          style={{ width: '100%' }}
        >
          {userGroups.map((g) => (
            <Select.Option key={g.id} value={g.id}>
              {g.name}
            </Select.Option>
          ))}
        </Form.Select>
      </Form>
    </Modal>
  );
};

export default BatchGroupModal;
