/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Modal,
  Form,
  Radio,
  Button,
  Space,
  Tag,
  Typography,
  Input,
  Empty,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete, IconSearch } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import ModelCategoryPickerModal from './ModelCategoryPickerModal';

const ModelSetModal = ({ visible, editingSet, onClose, onSuccess, t }) => {
  const formApiRef = useRef(null);
  const [configuredModels, setConfiguredModels] = useState([]);
  const [allPresetModels, setAllPresetModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedModels, setSelectedModels] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');

  useEffect(() => {
    if (visible) {
      loadPlatformModels();
      const initialList = editingSet?.models || [];
      setSelectedModels(initialList);
      setCustomModelInput('');

      if (formApiRef.current) {
        if (editingSet) {
          formApiRef.current.setValues({
            name: editingSet.name,
            description: editingSet.description || '',
            status: editingSet.status !== undefined ? editingSet.status : 1,
            models: initialList,
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
      const configuredSet = new Set();
      const presetSet = new Set();

      // 1. Fetch from Pricing (包含所有定价和系统模型)
      try {
        const resPricing = await API.get('/api/pricing');
        if (resPricing.data?.success && Array.isArray(resPricing.data?.data)) {
          resPricing.data.data.forEach((m) => {
            const name = typeof m === 'string' ? m : m.model_name || m.id || m.name;
            if (name) configuredSet.add(name);
          });
        }
      } catch (e) {
        // ignore
      }

      // 2. Fetch from Model Management (模型管理元数据)
      try {
        const resMeta = await API.get('/api/models/?p=1&page_size=1000');
        const metaItems = resMeta.data?.data?.items || resMeta.data?.data || [];
        if (Array.isArray(metaItems)) {
          metaItems.forEach((m) => {
            const name = typeof m === 'string' ? m : m.model_name || m.id || m.name;
            if (name) configuredSet.add(name);
          });
        }
      } catch (e) {
        // ignore
      }

      // 3. Fetch enabled models from channels (渠道已启用模型)
      try {
        const resEnabled = await API.get('/api/channel/models_enabled');
        if (resEnabled.data?.success && Array.isArray(resEnabled.data?.data)) {
          resEnabled.data.data.forEach((m) => {
            if (typeof m === 'string' && m) configuredSet.add(m);
            else if (m?.id) configuredSet.add(m.id);
            else if (m?.name) configuredSet.add(m.name);
          });
        }
      } catch (e) {
        // ignore
      }

      // 4. Fetch channel adapter predefined models
      try {
        const resChannelModels = await API.get('/api/channel/models');
        const channelList = resChannelModels.data?.data;
        if (Array.isArray(channelList)) {
          channelList.forEach((m) => {
            const name = typeof m === 'string' ? m : m.id || m.name;
            if (name) presetSet.add(name);
          });
        }
      } catch (e) {
        // ignore
      }

      // 5. Fetch dashboard models mapping
      try {
        const resModels = await API.get('/api/models');
        if (resModels.data?.data) {
          const data = resModels.data.data;
          if (Array.isArray(data)) {
            data.forEach((m) => {
              const name = typeof m === 'string' ? m : m.id || m.name;
              if (name) presetSet.add(name);
            });
          } else if (typeof data === 'object') {
            Object.values(data).forEach((val) => {
              if (Array.isArray(val)) {
                val.forEach((m) => {
                  const name = typeof m === 'string' ? m : m.id || m.name;
                  if (name) presetSet.add(name);
                });
              }
            });
          }
        }
      } catch (e) {
        // ignore
      }

      // 6. Include models already in editingSet
      if (editingSet?.models && Array.isArray(editingSet.models)) {
        editingSet.models.forEach((m) => {
          if (m) configuredSet.add(m);
        });
      }

      const confList = Array.from(configuredSet).filter(Boolean);
      confList.sort((a, b) => a.localeCompare(b));
      setConfiguredModels(confList);

      const presetList = Array.from(presetSet).filter(Boolean);
      presetList.sort((a, b) => a.localeCompare(b));
      setAllPresetModels(presetList);
    } catch (e) {
      // fallback
    } finally {
      setLoadingModels(false);
    }
  };

  const updateSelectedModels = (newModels) => {
    setSelectedModels(newModels);
    if (formApiRef.current) {
      formApiRef.current.setValue('models', newModels);
    }
  };

  const handleRemoveModel = (modelToRemove) => {
    const next = selectedModels.filter((m) => m !== modelToRemove);
    updateSelectedModels(next);
  };

  const handleAddCustomModel = () => {
    const trimmed = customModelInput.trim();
    if (!trimmed) return;
    if (selectedModels.includes(trimmed)) {
      showError(t('模型已在清单中'));
      return;
    }
    const next = [...selectedModels, trimmed];
    updateSelectedModels(next);
    setCustomModelInput('');
    showSuccess(t('已添加模型：{{name}}', { name: trimmed }));
  };

  const handleClearAll = () => {
    updateSelectedModels([]);
  };

  const handleSubmit = async () => {
    try {
      const values = await formApiRef.current.validate();
      if (!selectedModels || selectedModels.length === 0) {
        showError(t('请至少为模型集选择或添加一个模型'));
        return;
      }

      if (editingSet) {
        const res = await API.put(`/api/model-set/${editingSet.id}`, {
          name: values.name,
          description: values.description,
          status: Number(values.status),
          models: selectedModels,
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
          models: selectedModels,
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
    <>
      <Modal
        title={editingSet ? t('编辑模型集') : t('新建模型集')}
        visible={visible}
        onOk={handleSubmit}
        onCancel={onClose}
        width={720}
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

          {/* 模型清单管理区域 */}
          <div className='mt-4 flex flex-col gap-2'>
            <div className='flex justify-between items-center'>
              <div className='flex items-center gap-2'>
                <span className='font-medium text-[var(--semi-color-text-0)]'>
                  {t('包含的模型清单')}
                </span>
                <Tag color='blue' size='small'>
                  {t('已选 {{count}} 个', { count: selectedModels.length })}
                </Tag>
              </div>

              <Space>
                <Button
                  theme='solid'
                  type='primary'
                  size='small'
                  icon={<IconPlus />}
                  onClick={() => setShowPicker(true)}
                  loading={loadingModels}
                >
                  {t('分类选择模型')}
                </Button>
                {selectedModels.length > 0 && (
                  <Button
                    type='danger'
                    theme='borderless'
                    size='small'
                    onClick={handleClearAll}
                  >
                    {t('清空')}
                  </Button>
                )}
              </Space>
            </div>

            {/* 已选模型标签容器 */}
            <div className='min-h-[90px] max-h-[180px] overflow-y-auto p-3 rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] flex flex-wrap gap-1.5 items-center content-start'>
              {selectedModels.length === 0 ? (
                <div className='w-full text-center py-4 text-xs text-[var(--semi-color-text-2)]'>
                  {t(
                    '暂未选择任何模型，请点击上方「分类选择模型」按钮选择，或在下方输入添加自定义模型',
                  )}
                </div>
              ) : (
                selectedModels.map((m) => (
                  <Tag
                    key={m}
                    color='blue'
                    closable
                    onClose={() => handleRemoveModel(m)}
                    className='!text-xs'
                  >
                    {m}
                  </Tag>
                ))
              )}
            </div>

            {/* 手动添加自定义模型 */}
            <div className='flex items-center gap-2 mt-1'>
              <Input
                placeholder={t('输入任意自定义模型名称按回车或点击添加...')}
                value={customModelInput}
                onChange={(v) => setCustomModelInput(v)}
                onEnterPress={handleAddCustomModel}
                size='small'
              />
              <Button
                type='secondary'
                size='small'
                onClick={handleAddCustomModel}
              >
                {t('添加')}
              </Button>
            </div>
          </div>

          <Form.RadioGroup
            field='status'
            label={t('状态')}
            initValue={1}
            className='mt-4'
          >
            <Radio value={1}>{t('启用')}</Radio>
            <Radio value={2}>{t('禁用')}</Radio>
          </Form.RadioGroup>
        </Form>
      </Modal>

      {/* 分类选择模型弹窗 */}
      <ModelCategoryPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onConfirm={(newSelected) => {
          updateSelectedModels(newSelected);
        }}
        initialSelected={selectedModels}
        configuredModels={configuredModels}
        allPresetModels={allPresetModels}
        t={t}
      />
    </>
  );
};

export default ModelSetModal;

