/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useRef } from 'react';
import { Modal, Form, Radio, RadioGroup } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';

const UserGroupModal = ({ visible, editingGroup, onClose, onSuccess, t }) => {
  const formApiRef = useRef(null);

  useEffect(() => {
    if (visible && formApiRef.current) {
      if (editingGroup) {
        formApiRef.current.setValues({
          name: editingGroup.name,
          description: editingGroup.description || '',
          status: editingGroup.status !== undefined ? editingGroup.status : 1,
        });
      } else {
        formApiRef.current.setValues({
          name: '',
          description: '',
          status: 1,
        });
      }
    }
  }, [visible, editingGroup]);

  const handleSubmit = async () => {
    try {
      const values = await formApiRef.current.validate();
      if (editingGroup) {
        // Update
        const res = await API.put(`/api/user-group/${editingGroup.id}`, {
          name: values.name,
          description: values.description,
          status: Number(values.status),
        });
        if (res.data?.success) {
          showSuccess(t('更新用户组成功'));
          onSuccess();
        } else {
          showError(res.data?.message || '更新失败');
        }
      } else {
        // Create
        const res = await API.post('/api/user-group', {
          name: values.name,
          description: values.description,
          status: Number(values.status),
        });
        if (res.data?.success) {
          showSuccess(t('创建用户组成功'));
          onSuccess();
        } else {
          showError(res.data?.message || '创建失败');
        }
      }
    } catch (e) {
      // form validation
    }
  };

  return (
    <Modal
      title={editingGroup ? t('编辑用户组') : t('新建用户组')}
      visible={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnClose
    >
      <Form getFormApi={(api) => (formApiRef.current = api)}>
        <Form.Input
          field='name'
          label={t('用户组名称')}
          placeholder={t('例如：开发组、算法组、实习生组')}
          rules={[{ required: true, message: t('请输入用户组名称') }]}
        />
        <Form.TextArea
          field='description'
          label={t('用户组说明')}
          placeholder={t('说明该组的用途及授权范围（可选）')}
          rows={3}
        />
        <Form.RadioGroup field='status' label={t('状态')} initValue={1}>
          <Radio value={1}>{t('启用')}</Radio>
          <Radio value={2}>{t('禁用')}</Radio>
        </Form.RadioGroup>
      </Form>
    </Modal>
  );
};

export default UserGroupModal;
