/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  SideSheet,
  Form,
  Radio,
  Button,
  Space,
  Tag,
  Typography,
  Input,
  Card,
  Avatar,
  Spin,
  Row,
  Col,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconSave,
  IconClose,
  IconBox,
  IconLayers,
} from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import ModelCategoryPickerModal from './ModelCategoryPickerModal';

const { Title, Text } = Typography;

const ModelSetModal = ({ visible, editingSet, onClose, onSuccess, t }) => {
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const [configuredModels, setConfiguredModels] = useState([]);
  const [allPresetModels, setAllPresetModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedModels, setSelectedModels] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [loading, setLoading] = useState(false);

  const isEdit = Boolean(editingSet);

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

      // 1. Fetch from Pricing
      try {
        const resPricing = await API.get('/api/pricing');
        if (resPricing.data?.success && Array.isArray(resPricing.data?.data)) {
          resPricing.data.data.forEach((m) => {
            const name = typeof m === 'string' ? m : m.model_name || m.id || m.name;
            if (name) configuredSet.add(name);
          });
        }
      } catch (e) {}

      // 2. Fetch from Model Management
      try {
        const resMeta = await API.get('/api/models/?p=1&page_size=1000');
        const metaItems = resMeta.data?.data?.items || resMeta.data?.data || [];
        if (Array.isArray(metaItems)) {
          metaItems.forEach((m) => {
            const name = typeof m === 'string' ? m : m.model_name || m.id || m.name;
            if (name) configuredSet.add(name);
          });
        }
      } catch (e) {}

      // 3. Fetch enabled models from channels
      try {
        const resEnabled = await API.get('/api/channel/models_enabled');
        if (resEnabled.data?.success && Array.isArray(resEnabled.data.data)) {
          resEnabled.data.data.forEach((m) => {
            if (typeof m === 'string' && m) configuredSet.add(m);
            else if (m?.id) configuredSet.add(m.id);
            else if (m?.name) configuredSet.add(m.name);
          });
        }
      } catch (e) {}

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
      } catch (e) {}

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
      } catch (e) {}

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

      setLoading(true);
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
          onClose();
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
          onClose();
        } else {
          showError(res.data?.message || '创建失败');
        }
      }
    } catch (e) {
      // validation error
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SideSheet
        placement='right'
        title={
          <Space>
            <Tag color={isEdit ? 'blue' : 'green'} shape='circle'>
              {isEdit ? t('更新') : t('新建')}
            </Tag>
            <Title heading={4} className='m-0'>
              {isEdit ? t('编辑模型集') : t('新建模型集')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={visible}
        width={isMobile ? '100%' : 680}
        footer={
          <div className='flex justify-end bg-white p-3'>
            <Space>
              <Button
                theme='solid'
                className='!rounded-lg'
                onClick={handleSubmit}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
                className='!rounded-lg'
                type='primary'
                onClick={onClose}
                icon={<IconClose />}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={onClose}
      >
        <Spin spinning={loading}>
          <Form getFormApi={(api) => (formApiRef.current = api)}>
            <div className='p-2 space-y-3'>
              {/* 基本信息卡片 */}
              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-3'>
                  <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                    <IconBox size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('定义模型集的名称与适用场景')}
                    </div>
                  </div>
                </div>

                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Input
                      field='name'
                      label={t('模型集名称')}
                      placeholder={t('例如：通用大语言模型集、编程助手模型集')}
                      rules={[{ required: true, message: t('请输入模型集名称') }]}
                      showClear
                    />
                  </Col>

                  <Col span={24}>
                    <Form.TextArea
                      field='description'
                      label={t('模型集说明')}
                      placeholder={t('说明该模型集的适用场景及包含能力（可选）')}
                      rows={3}
                      showClear
                    />
                  </Col>

                  <Col span={24}>
                    <Form.RadioGroup
                      field='status'
                      label={t('状态')}
                      initValue={1}
                    >
                      <Radio value={1}>{t('启用')}</Radio>
                      <Radio value={2}>{t('禁用')}</Radio>
                    </Form.RadioGroup>
                  </Col>
                </Row>
              </Card>

              {/* 模型清单管理卡片 */}
              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-3'>
                  <Avatar size='small' color='purple' className='mr-2 shadow-md'>
                    <IconLayers size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('包含的模型清单')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('已选 {{count}} 个模型', {
                        count: selectedModels.length,
                      })}
                    </div>
                  </div>
                </div>

                <div className='flex flex-col gap-3'>
                  <div className='flex justify-between items-center'>
                    <Text type='secondary' className='text-xs'>
                      {t('从系统支持的分类中选择模型，或直接输入自定义模型')}
                    </Text>
                    <Space>
                      <Button
                        theme='solid'
                        type='primary'
                        size='small'
                        className='!rounded-lg'
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
                  <div className='min-h-[100px] max-h-[220px] overflow-y-auto p-3 rounded-2xl border border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] flex flex-wrap gap-1.5 items-center content-start'>
                    {selectedModels.length === 0 ? (
                      <div className='w-full text-center py-6 text-xs text-[var(--semi-color-text-2)]'>
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
                          className='!rounded-md'
                        >
                          {m}
                        </Tag>
                      ))
                    )}
                  </div>

                  {/* 手动添加自定义模型 */}
                  <div className='flex items-center gap-2 pt-1'>
                    <Input
                      placeholder={t('输入自定义模型名称按回车或点击添加...')}
                      value={customModelInput}
                      onChange={(v) => setCustomModelInput(v)}
                      onEnterPress={handleAddCustomModel}
                      className='!rounded-lg'
                      showClear
                    />
                    <Button
                      type='secondary'
                      theme='light'
                      className='!rounded-lg'
                      onClick={handleAddCustomModel}
                    >
                      {t('添加')}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </Form>
        </Spin>
      </SideSheet>

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
