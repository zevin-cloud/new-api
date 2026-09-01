/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useRef } from 'react';
import { Modal, Form, Typography } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';

const DepartmentModal = ({ visible, editingDept, parentDeptId, onClose, onSuccess, t }) => {
  const formApiRef = useRef(null);

  useEffect(() => {
    if (visible && formApiRef.current) {
      if (editingDept) {
        formApiRef.current.setValues({
          name: editingDept.name,
          description: editingDept.description || '',
          sort_order: editingDept.sort_order || 0,
        });
      } else {
        formApiRef.current.setValues({
          name: '',
          description: '',
          sort_order: 0,
        });
      }
    }
  }, [visible, editingDept]);

  const handleSubmit = async () => {
    try {
      const values = await formApiRef.current.validate();
      if (editingDept) {
        // Update
        const payload = {
          id: editingDept.id,
          name: values.name,
          description: values.description,
          sort_order: Number(values.sort_order) || 0,
          parent_id: editingDept.parent_id,
        };
        const res = await API.put('/api/department', payload);
        if (res.data?.success) {
          showSuccess(t('更新部门成功'));
          onSuccess();
        } else {
          showError(res.data?.message || '更新失败');
        }
      } else {
        // Create
        const payload = {
          name: values.name,
          description: values.description,
          sort_order: Number(values.sort_order) || 0,
          parent_id: parentDeptId || 0,
        };
        const res = await API.post('/api/department', payload);
        if (res.data?.success) {
          showSuccess(t('创建部门成功'));
          onSuccess();
        } else {
          showError(res.data?.message || '创建失败');
        }
      }
    } catch (e) {
      // Form validation error
    }
  };

  return (
    <Modal
      title={editingDept ? t('编辑部门') : t('新建部门')}
      visible={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      centered
      destroyOnClose
    >
      <Form getFormApi={(api) => (formApiRef.current = api)}>
        <Form.Input
          field='name'
          label={t('部门名称')}
          rules={[{ required: true, message: t('请输入部门名称') }]}
          placeholder={t('例如：研发中心、后端组')}
        />
        <Form.InputNumber
          field='sort_order'
          label={t('排序序号')}
          placeholder={t('数值越小越靠前')}
          initValue={0}
        />
        <Form.TextArea
          field='description'
          label={t('部门说明')}
          placeholder={t('部门职能与管理范围说明（可选）')}
          rows={3}
        />
      </Form>
    </Modal>
  );
};

export default DepartmentModal;
