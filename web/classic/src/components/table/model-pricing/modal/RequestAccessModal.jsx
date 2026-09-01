/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useRef } from 'react';
import { Modal, Form, Typography, Tag, InputNumber } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';

const { Text } = Typography;

const RequestAccessModal = ({ visible, modelName, onClose, onSuccess, t }) => {
  const formApiRef = useRef(null);

  const handleSubmit = async () => {
    try {
      const values = await formApiRef.current.validate();
      const res = await API.post('/api/user/model-access-request', {
        target_type: 1, // Model
        target_name: modelName,
        reason: values.reason,
        expected_duration_days: Number(values.duration_days) || 0,
      });
      if (res.data?.success) {
        showSuccess(t('权限申请已提交，请等待管理员审批'));
        onSuccess();
      } else {
        showError(res.data?.message || '提交申请失败');
      }
    } catch (e) {
      // validation error
    }
  };

  return (
    <Modal
      title={t('申请模型访问权限')}
      visible={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnClose
    >
      <div className='mb-4 p-3 bg-[var(--semi-color-fill-0)] rounded-lg flex items-center justify-between'>
        <Text>{t('申请目标模型')}:</Text>
        <Tag color='blue' size='large'>{modelName}</Tag>
      </div>

      <Form getFormApi={(api) => (formApiRef.current = api)}>
        <Form.TextArea
          field='reason'
          label={t('申请理由与预期业务场景')}
          placeholder={t('请简要描述您的业务诉求、预期调用量及使用场景')}
          rules={[{ required: true, message: t('请输入申请理由') }]}
          rows={3}
        />
        <Form.InputNumber
          field='duration_days'
          label={t('期望使用天数')}
          placeholder={t('0 表示申请长期有效')}
          initValue={30}
          min={0}
        />
      </Form>
    </Modal>
  );
};

export default RequestAccessModal;
