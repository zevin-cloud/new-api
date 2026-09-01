/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Form, Select, Radio, RadioGroup, Typography, Space, Tag } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../../helpers';

const ModelSetModal = ({ visible, editingSet, onClose, onSuccess, t }) => {
  const formApiRef = useRef(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPlatformModels();
      if (formApiRef.current) {
        if (editingSet) {
          formApiRef.current.setValues({
            name: editingSet.name,
            description: editingSet.description || '',
            status: editingSet.status !== undefined ? editingSet.status : 1,
            models: editingSet.models || [],
          });
        } else {
          formApiRef.current.setValues({
            name: '',
            description: '',
            status: 1,
            models: [],
          });
        }
      }
    }
  }, [visible, editingSet]);

  const loadPlatformModels = async () => {
    setLoadingModels(true);
    try {
      const res = await API.get('/api/models');
      if (res.data?.data) {
        const modelNames = res.data.data.map((m) => typeof m === 'string' ? m : m.id || m.name);
        setAvailableModels(Array.from(new Set(modelNames)).filter(Boolean));
      }
    } catch (e) {
      // fallback
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await formApiRef.current.validate();
      if (editingSet) {
        const res = await API.put(`/api/model-set/${editingSet.id}`, {
          name: values.name,
          description: values.description,
          status: Number(values.status),
          models: values.models || [],
        });
        if (res.data?.success) {
          showSuccess(t('更新模型集成功'));
          onSuccess();
        } else {
          showError(res.data?.message || '更新失败');
        }
      } else {
        const res = await API.post('/api/model-set', {
          name: values.name,
          description: values.description,
          status: Number(values.status),
          models: values.models || [],
        });
        if (res.data?.success) {
          showSuccess(t('创建模型集成功'));
          onSuccess();
        } else {
          showError(res.data?.message || '创建失败');
        }
      }
    } catch (e) {
      // validation error
    }
  };

  return (
    <Modal
      title={editingSet ? t('编辑模型集') : t('新建模型集')}
      visible={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      width={680}
      destroyOnClose
    >
      <Form getFormApi={(api) => (formApiRef.current = api)}>
        <Form.Input
          field='name'
          label={t('模型集名称')}
          placeholder={t('例如：通用大语言模型集、编程助手模型集')}
          rules={[{ required: true, message: t('请输入模型集名称') }]}
        />
        <Form.TextArea
          field='description'
          label={t('模型集说明')}
          placeholder={t('说明该模型集的适用场景及包含能力（可选）')}
          rows={2}
        />
        <Form.Select
          field='models'
          label={t('包含的模型清单')}
          placeholder={t('请选择要纳入该模型集的模型')}
          multiple
          filter
          loading={loadingModels}
          style={{ width: '100%' }}
        >
          {availableModels.map((m) => (
            <Select.Option key={m} value={m}>
              {m}
            </Select.Option>
          ))}
        </Form.Select>
        <Form.RadioGroup field='status' label={t('状态')} initValue={1}>
          <Radio value={1}>{t('启用')}</Radio>
          <Radio value={2}>{t('禁用')}</Radio>
        </Form.RadioGroup>
      </Form>
    </Modal>
  );
};

export default ModelSetModal;
