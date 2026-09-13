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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSONEditor from '../../../common/ui/JSONEditor';
import {
  Banner,
  SideSheet,
  Form,
  Button,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Avatar,
  Col,
  Row,
} from '@douyinfe/semi-ui';
import { Save, X, FileText } from 'lucide-react';
import { IconAlertTriangle, IconLink } from '@douyinfe/semi-icons';
import { API, showError, showSuccess } from '../../../../helpers';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import ModelPricingSection from '../components/ModelPricingSection';

const { Text, Title } = Typography;

// Example endpoint template for quick fill
const ENDPOINT_TEMPLATE = {
  openai: { path: '/v1/chat/completions', method: 'POST' },
  'openai-response': { path: '/v1/responses', method: 'POST' },
  'openai-response-compact': { path: '/v1/responses/compact', method: 'POST' },
  anthropic: { path: '/v1/messages', method: 'POST' },
  gemini: { path: '/v1beta/models/{model}:generateContent', method: 'POST' },
  'jina-rerank': { path: '/v1/rerank', method: 'POST' },
  'image-generation': { path: '/v1/images/generations', method: 'POST' },
};

const nameRuleOptions = [
  { label: '精确名称匹配', value: 0 },
  { label: '前缀名称匹配', value: 1 },
  { label: '包含名称匹配', value: 2 },
  { label: '后缀名称匹配', value: 3 },
];

const EditModelModal = (props) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const isEdit = props.editingModel && props.editingModel.id !== undefined;
  const placement = useMemo(() => (isEdit ? 'right' : 'left'), [isEdit]);

  // 供应商列表
  const [vendors, setVendors] = useState([]);

  // 预填组（标签、端点）
  const [tagGroups, setTagGroups] = useState([]);
  const [endpointGroups, setEndpointGroups] = useState([]);

  // 定价与系统设置绑定状态
  const rawOptionsRef = useRef({});
  const initialOptionMapsRef = useRef({});
  const pricingListRef = useRef([]);
  const initialPricingValuesRef = useRef({});
  const [isCustomPricing, setIsCustomPricing] = useState(false);
  const [hasSystemDefault, setHasSystemDefault] = useState(false);
  const [resetPricingRequested, setResetPricingRequested] = useState(false);

  // 获取供应商列表
  const fetchVendors = async () => {
    try {
      const res = await API.get('/api/vendors/?page_size=1000'); // 获取全部供应商
      if (res.data.success) {
        const items = res.data.data.items || res.data.data || [];
        setVendors(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      // ignore
    }
  };

  // 获取预填组（标签、端点）
  const fetchPrefillGroups = async () => {
    try {
      const [tagRes, endpointRes] = await Promise.all([
        API.get('/api/prefill_group?type=tag'),
        API.get('/api/prefill_group?type=endpoint'),
      ]);
      if (tagRes?.data?.success) {
        setTagGroups(tagRes.data.data || []);
      }
      if (endpointRes?.data?.success) {
        setEndpointGroups(endpointRes.data.data || []);
      }
    } catch (error) {
      // ignore
    }
  };

  const getInitValues = () => ({
    model_name: props.editingModel?.model_name || '',
    description: '',
    icon: '',
    tags: [],
    vendor_id: undefined,
    vendor: '',
    vendor_icon: '',
    endpoints: '',
    name_rule: props.editingModel?.model_name ? 0 : undefined, // 通过未配置模型过来的固定为精确匹配
    status: true,
    sync_official: 1,
    max_concurrency: props.editingModel?.max_concurrency || 0,
    billing_mode: 'per-token',
    input_price: '',
    completion_price: '',
    cache_price: '',
    create_cache_price: '',
    audio_input_price: '',
    audio_output_price: '',
    image_ratio: '',
    fixed_price: '',
  });

  const handleCancel = () => {
    props.handleClose();
  };

  const parseJSON = (str) => {
    if (!str || typeof str !== 'string') return {};
    try {
      const res = JSON.parse(str);
      return res && typeof res === 'object' ? res : {};
    } catch {
      return {};
    }
  };

  const cleanNumberStr = (num) => {
    if (num === null || num === undefined || num === '' || isNaN(Number(num))) return '';
    const val = Number(num);
    return parseFloat(val.toFixed(6)).toString();
  };

  const extractModelPricingValues = (modelName, optMaps, pList) => {
    const result = {
      billing_mode: 'per-token',
      input_price: '',
      completion_price: '',
      cache_price: '',
      create_cache_price: '',
      audio_input_price: '',
      audio_output_price: '',
      image_ratio: '',
      fixed_price: '',
      isCustom: false,
      hasDefault: false,
    };

    if (!modelName) return result;

    const modelPriceMap = optMaps.ModelPrice || {};
    const modelRatioMap = optMaps.ModelRatio || {};
    const completionRatioMap = optMaps.CompletionRatio || {};
    const cacheRatioMap = optMaps.CacheRatio || {};
    const createCacheRatioMap = optMaps.CreateCacheRatio || {};
    const imageRatioMap = optMaps.ImageRatio || {};
    const audioRatioMap = optMaps.AudioRatio || {};
    const audioCompletionRatioMap = optMaps.AudioCompletionRatio || {};

    if (modelPriceMap[modelName] !== undefined && modelPriceMap[modelName] !== '') {
      result.billing_mode = 'per-request';
      result.fixed_price = cleanNumberStr(modelPriceMap[modelName]);
      result.isCustom = true;
      return result;
    }

    if (modelRatioMap[modelName] !== undefined && modelRatioMap[modelName] !== '') {
      result.billing_mode = 'per-token';
      const ratio = Number(modelRatioMap[modelName]);
      const inPrice = ratio * 2;
      result.input_price = cleanNumberStr(inPrice);

      if (completionRatioMap[modelName] !== undefined && completionRatioMap[modelName] !== '') {
        result.completion_price = cleanNumberStr(inPrice * Number(completionRatioMap[modelName]));
      }
      if (cacheRatioMap[modelName] !== undefined && cacheRatioMap[modelName] !== '') {
        result.cache_price = cleanNumberStr(inPrice * Number(cacheRatioMap[modelName]));
      }
      if (createCacheRatioMap[modelName] !== undefined && createCacheRatioMap[modelName] !== '') {
        result.create_cache_price = cleanNumberStr(inPrice * Number(createCacheRatioMap[modelName]));
      }
      if (audioRatioMap[modelName] !== undefined && audioRatioMap[modelName] !== '') {
        const audioInPrice = inPrice * Number(audioRatioMap[modelName]);
        result.audio_input_price = cleanNumberStr(audioInPrice);
        if (audioCompletionRatioMap[modelName] !== undefined && audioCompletionRatioMap[modelName] !== '') {
          result.audio_output_price = cleanNumberStr(audioInPrice * Number(audioCompletionRatioMap[modelName]));
        }
      }
      if (imageRatioMap[modelName] !== undefined && imageRatioMap[modelName] !== '') {
        result.image_ratio = cleanNumberStr(imageRatioMap[modelName]);
      }
      result.isCustom = true;
      return result;
    }

    if (Array.isArray(pList)) {
      const p = pList.find(
        (item) => (item.model_name || item.ModelName) === modelName,
      );
      if (p) {
        result.hasDefault = true;
        if (p.quota_type === 1 || p.quota_type === 'times' || (p.model_price && !p.model_ratio)) {
          result.billing_mode = 'per-request';
          result.fixed_price = cleanNumberStr(p.model_price);
        } else {
          result.billing_mode = 'per-token';
          const ratio = p.model_ratio !== undefined ? Number(p.model_ratio) : null;
          if (ratio !== null) {
            const inPrice = ratio * 2;
            result.input_price = cleanNumberStr(inPrice);
            if (p.completion_ratio !== undefined) {
              result.completion_price = cleanNumberStr(inPrice * Number(p.completion_ratio));
            }
            if (p.cache_ratio !== undefined) {
              result.cache_price = cleanNumberStr(inPrice * Number(p.cache_ratio));
            }
            if (p.create_cache_ratio !== undefined) {
              result.create_cache_price = cleanNumberStr(inPrice * Number(p.create_cache_ratio));
            }
            if (p.audio_ratio !== undefined) {
              const audioInPrice = inPrice * Number(p.audio_ratio);
              result.audio_input_price = cleanNumberStr(audioInPrice);
              if (p.audio_completion_ratio !== undefined) {
                result.audio_output_price = cleanNumberStr(audioInPrice * Number(p.audio_completion_ratio));
              }
            }
            if (p.image_ratio !== undefined) {
              result.image_ratio = cleanNumberStr(p.image_ratio);
            }
          }
        }
      }
    }

    return result;
  };

  const loadModalData = async () => {
    setLoading(true);
    setResetPricingRequested(false);
    try {
      const promises = [
        API.get('/api/option/'),
        API.get('/api/pricing'),
      ];
      if (isEdit && props.editingModel?.id) {
        promises.push(API.get(`/api/models/${props.editingModel.id}`));
      }

      const [optRes, priceRes, modelRes] = await Promise.all(promises);

      const optMap = {};
      if (optRes?.data?.success && Array.isArray(optRes.data.data)) {
        optRes.data.data.forEach((item) => {
          optMap[item.key] = item.value;
        });
      }
      rawOptionsRef.current = optMap;

      const optMaps = {
        ModelPrice: parseJSON(optMap.ModelPrice),
        ModelRatio: parseJSON(optMap.ModelRatio),
        CompletionRatio: parseJSON(optMap.CompletionRatio),
        CacheRatio: parseJSON(optMap.CacheRatio),
        CreateCacheRatio: parseJSON(optMap.CreateCacheRatio),
        ImageRatio: parseJSON(optMap.ImageRatio),
        AudioRatio: parseJSON(optMap.AudioRatio),
        AudioCompletionRatio: parseJSON(optMap.AudioCompletionRatio),
      };
      initialOptionMapsRef.current = optMaps;

      const pList = priceRes?.data?.success && Array.isArray(priceRes.data.data) ? priceRes.data.data : [];
      pricingListRef.current = pList;

      let modelData = {};
      if (modelRes?.data?.success) {
        const data = modelRes.data.data;
        if (data.tags) {
          data.tags = data.tags.split(',').filter(Boolean);
        } else {
          data.tags = [];
        }
        if (!data.endpoints) {
          data.endpoints = '';
        }
        data.status = data.status === 1;
        data.sync_official = (data.sync_official ?? 1) === 1;
        modelData = data;
      }

      const targetModelName = modelData.model_name || props.editingModel?.model_name || '';
      const pricing = extractModelPricingValues(targetModelName, optMaps, pList);

      setIsCustomPricing(pricing.isCustom);
      setHasSystemDefault(pricing.hasDefault);
      initialPricingValuesRef.current = { ...pricing };

      if (formApiRef.current) {
        formApiRef.current.setValues({
          ...getInitValues(),
          ...(isEdit ? modelData : { model_name: props.editingModel?.model_name || '' }),
          billing_mode: pricing.billing_mode,
          input_price: pricing.input_price,
          completion_price: pricing.completion_price,
          cache_price: pricing.cache_price,
          create_cache_price: pricing.create_cache_price,
          audio_input_price: pricing.audio_input_price,
          audio_output_price: pricing.audio_output_price,
          image_ratio: pricing.image_ratio,
          fixed_price: pricing.fixed_price,
        });
      }
    } catch (error) {
      console.error('加载模型数据失败:', error);
      showError(t('加载模型信息失败'));
    }
    setLoading(false);
  };

  const handleResetToDefault = () => {
    setIsCustomPricing(false);
    setResetPricingRequested(true);
    const currentName = formApiRef.current?.getValue('model_name') || '';
    const defaultPricing = extractModelPricingValues(currentName, {}, pricingListRef.current);
    if (defaultPricing.hasDefault) {
      setHasSystemDefault(true);
      formApiRef.current?.setValues({
        ...formApiRef.current?.getValues(),
        billing_mode: defaultPricing.billing_mode,
        input_price: defaultPricing.input_price,
        completion_price: defaultPricing.completion_price,
        cache_price: defaultPricing.cache_price,
        create_cache_price: defaultPricing.create_cache_price,
        audio_input_price: defaultPricing.audio_input_price,
        audio_output_price: defaultPricing.audio_output_price,
        image_ratio: defaultPricing.image_ratio,
        fixed_price: defaultPricing.fixed_price,
      });
    } else {
      setHasSystemDefault(false);
      formApiRef.current?.setValues({
        ...formApiRef.current?.getValues(),
        billing_mode: 'per-token',
        input_price: '',
        completion_price: '',
        cache_price: '',
        create_cache_price: '',
        audio_input_price: '',
        audio_output_price: '',
        image_ratio: '',
        fixed_price: '',
      });
    }
  };

  const handleModelNameBlur = () => {
    const currentName = formApiRef.current?.getValue('model_name')?.trim();
    if (!currentName) return;

    const currentInputPrice = formApiRef.current?.getValue('input_price');
    const currentFixedPrice = formApiRef.current?.getValue('fixed_price');

    if (!isCustomPricing && !currentInputPrice && !currentFixedPrice) {
      const optMaps = initialOptionMapsRef.current || {};
      const pricing = extractModelPricingValues(currentName, optMaps, pricingListRef.current);
      if (pricing.isCustom || pricing.hasDefault) {
        setIsCustomPricing(pricing.isCustom);
        setHasSystemDefault(pricing.hasDefault);
        formApiRef.current?.setValues({
          ...formApiRef.current?.getValues(),
          billing_mode: pricing.billing_mode,
          input_price: pricing.input_price,
          completion_price: pricing.completion_price,
          cache_price: pricing.cache_price,
          create_cache_price: pricing.create_cache_price,
          audio_input_price: pricing.audio_input_price,
          audio_output_price: pricing.audio_output_price,
          image_ratio: pricing.image_ratio,
          fixed_price: pricing.fixed_price,
        });
      }
    }
  };

  const savePricingOptions = async (values, oldModelName, newModelName) => {
    if (!initialOptionMapsRef.current || !newModelName) return;

    const optionKeys = [
      'ModelPrice',
      'ModelRatio',
      'CompletionRatio',
      'CacheRatio',
      'CreateCacheRatio',
      'ImageRatio',
      'AudioRatio',
      'AudioCompletionRatio',
    ];

    const nextMaps = {};
    optionKeys.forEach((key) => {
      nextMaps[key] = { ...(initialOptionMapsRef.current[key] || {}) };
    });

    if (oldModelName && oldModelName !== newModelName) {
      optionKeys.forEach((key) => {
        delete nextMaps[key][oldModelName];
      });
    }

    const hasInputPrice = values.input_price !== undefined && values.input_price !== '' && values.input_price !== null;
    const hasFixedPrice = values.fixed_price !== undefined && values.fixed_price !== '' && values.fixed_price !== null;

    const initPricing = initialPricingValuesRef.current || {};
    const pricingValuesModified =
      values.billing_mode !== initPricing.billing_mode ||
      values.input_price !== initPricing.input_price ||
      values.completion_price !== initPricing.completion_price ||
      values.cache_price !== initPricing.cache_price ||
      values.create_cache_price !== initPricing.create_cache_price ||
      values.audio_input_price !== initPricing.audio_input_price ||
      values.audio_output_price !== initPricing.audio_output_price ||
      values.image_ratio !== initPricing.image_ratio ||
      values.fixed_price !== initPricing.fixed_price;

    if (resetPricingRequested) {
      optionKeys.forEach((key) => {
        delete nextMaps[key][newModelName];
      });
    } else if (!isCustomPricing && !pricingValuesModified) {
      // Keep system default without writing to custom options
    } else if (values.billing_mode === 'per-request' && hasFixedPrice) {
      delete nextMaps.ModelRatio[newModelName];
      delete nextMaps.CompletionRatio[newModelName];
      delete nextMaps.CacheRatio[newModelName];
      delete nextMaps.CreateCacheRatio[newModelName];
      delete nextMaps.ImageRatio[newModelName];
      delete nextMaps.AudioRatio[newModelName];
      delete nextMaps.AudioCompletionRatio[newModelName];

      nextMaps.ModelPrice[newModelName] = Number(Number(values.fixed_price).toFixed(6));
    } else if (values.billing_mode === 'per-token' && hasInputPrice) {
      delete nextMaps.ModelPrice[newModelName];

      const inPrice = Number(values.input_price);
      nextMaps.ModelRatio[newModelName] = Number((inPrice / 2).toFixed(6));

      if (values.completion_price !== '' && values.completion_price !== undefined && values.completion_price !== null) {
        const compPrice = Number(values.completion_price);
        if (inPrice > 0) {
          nextMaps.CompletionRatio[newModelName] = Number((compPrice / inPrice).toFixed(6));
        } else {
          delete nextMaps.CompletionRatio[newModelName];
        }
      } else {
        delete nextMaps.CompletionRatio[newModelName];
      }

      if (values.cache_price !== '' && values.cache_price !== undefined && values.cache_price !== null) {
        const cachePrice = Number(values.cache_price);
        if (inPrice > 0) {
          nextMaps.CacheRatio[newModelName] = Number((cachePrice / inPrice).toFixed(6));
        } else {
          delete nextMaps.CacheRatio[newModelName];
        }
      } else {
        delete nextMaps.CacheRatio[newModelName];
      }

      if (values.create_cache_price !== '' && values.create_cache_price !== undefined && values.create_cache_price !== null) {
        const createCachePrice = Number(values.create_cache_price);
        if (inPrice > 0) {
          nextMaps.CreateCacheRatio[newModelName] = Number((createCachePrice / inPrice).toFixed(6));
        } else {
          delete nextMaps.CreateCacheRatio[newModelName];
        }
      } else {
        delete nextMaps.CreateCacheRatio[newModelName];
      }

      if (values.audio_input_price !== '' && values.audio_input_price !== undefined && values.audio_input_price !== null) {
        const audioInPrice = Number(values.audio_input_price);
        if (inPrice > 0) {
          nextMaps.AudioRatio[newModelName] = Number((audioInPrice / inPrice).toFixed(6));
        } else {
          delete nextMaps.AudioRatio[newModelName];
        }
      } else {
        delete nextMaps.AudioRatio[newModelName];
      }

      if (values.audio_output_price !== '' && values.audio_output_price !== undefined && values.audio_output_price !== null) {
        const audioOutPrice = Number(values.audio_output_price);
        const audioInPrice = Number(values.audio_input_price);
        if (audioInPrice > 0) {
          nextMaps.AudioCompletionRatio[newModelName] = Number((audioOutPrice / audioInPrice).toFixed(6));
        } else {
          delete nextMaps.AudioCompletionRatio[newModelName];
        }
      } else {
        delete nextMaps.AudioCompletionRatio[newModelName];
      }

      if (values.image_ratio !== '' && values.image_ratio !== undefined && values.image_ratio !== null) {
        nextMaps.ImageRatio[newModelName] = Number(Number(values.image_ratio).toFixed(6));
      } else {
        delete nextMaps.ImageRatio[newModelName];
      }
    } else {
      optionKeys.forEach((key) => {
        delete nextMaps[key][newModelName];
      });
    }

    const updatePromises = [];
    optionKeys.forEach((key) => {
      const origStr = JSON.stringify(initialOptionMapsRef.current[key] || {});
      const newStr = JSON.stringify(nextMaps[key] || {});
      if (origStr !== newStr) {
        updatePromises.push(
          API.put('/api/option/', {
            key,
            value: JSON.stringify(nextMaps[key], null, 2),
          })
        );
      }
    });

    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      for (const res of results) {
        if (!res?.data?.success) {
          throw new Error(res?.data?.message || t('更新定价设置失败'));
        }
      }
    }
  };

  useEffect(() => {
    if (props.visiable) {
      fetchVendors();
      fetchPrefillGroups();
      loadModalData();
    } else {
      formApiRef.current?.reset();
      setIsCustomPricing(false);
      setHasSystemDefault(false);
      setResetPricingRequested(false);
    }
  }, [props.visiable, props.editingModel?.id, props.editingModel?.model_name]);

  const submit = async (values) => {
    setLoading(true);
    try {
      const submitData = {
        ...values,
        tags: Array.isArray(values.tags) ? values.tags.join(',') : values.tags,
        endpoints: values.endpoints || '',
        status: values.status ? 1 : 0,
        sync_official: values.sync_official ? 1 : 0,
        max_concurrency: Number(values.max_concurrency || 0),
      };

      // Strip pricing fields before updating models table
      delete submitData.billing_mode;
      delete submitData.input_price;
      delete submitData.completion_price;
      delete submitData.cache_price;
      delete submitData.create_cache_price;
      delete submitData.audio_input_price;
      delete submitData.audio_output_price;
      delete submitData.image_ratio;
      delete submitData.fixed_price;

      if (isEdit) {
        submitData.id = props.editingModel.id;
        const res = await API.put('/api/models/', submitData);
        const { success, message } = res.data;
        if (!success) {
          showError(t(message));
          setLoading(false);
          return;
        }
      } else {
        const res = await API.post('/api/models/', submitData);
        const { success, message } = res.data;
        if (!success) {
          showError(t(message));
          setLoading(false);
          return;
        }
      }

      // Save and synchronize pricing options with System Settings
      const oldModelName = isEdit ? props.editingModel.model_name : '';
      const newModelName = values.model_name?.trim();
      await savePricingOptions(values, oldModelName, newModelName);

      showSuccess(isEdit ? t('模型更新成功！') : t('模型创建成功！'));
      props.refresh();
      props.handleClose();
    } catch (error) {
      showError(error.response?.data?.message || error.message || t('操作失败'));
    }
    setLoading(false);
    formApiRef.current?.setValues(getInitValues());
  };

  return (
    <SideSheet
      placement={placement}
      title={
        <Space>
          {isEdit ? (
            <Tag color='blue' shape='circle'>
              {t('更新')}
            </Tag>
          ) : (
            <Tag color='green' shape='circle'>
              {t('新建')}
            </Tag>
          )}
          <Title heading={4} className='m-0'>
            {isEdit ? t('更新模型信息') : t('创建新的模型')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: '0' }}
      visible={props.visiable}
      width={isMobile ? '100%' : 600}
      footer={
        <div className='flex justify-end bg-white'>
          <Space>
            <Button
              theme='solid'
              className='!rounded-lg'
              onClick={() => formApiRef.current?.submitForm()}
              icon={<Save size={16} />}
              loading={loading}
            >
              {t('提交')}
            </Button>
            <Button
              theme='light'
              className='!rounded-lg'
              type='primary'
              onClick={handleCancel}
              icon={<X size={16} />}
            >
              {t('取消')}
            </Button>
          </Space>
        </div>
      }
      closeIcon={null}
      onCancel={() => handleCancel()}
    >
      <Spin spinning={loading}>
        <Form
          key={isEdit ? 'edit' : 'new'}
          initValues={getInitValues()}
          getFormApi={(api) => (formApiRef.current = api)}
          onSubmit={submit}
        >
          {({ values }) => (
            <div className='p-2'>
              {/* 基本信息 */}
              <Card className='!rounded-2xl shadow-sm border-0'>
                <div className='flex items-center mb-2'>
                  <Avatar size='small' color='green' className='mr-2 shadow-md'>
                    <FileText size={16} />
                  </Avatar>
                  <div>
                    <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                    <div className='text-xs text-gray-600'>
                      {t('设置模型的基本信息')}
                    </div>
                  </div>
                </div>
                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Input
                      field='model_name'
                      label={t('模型名称')}
                      placeholder={t('请输入模型名称，如：gpt-4')}
                      rules={[{ required: true, message: t('请输入模型名称') }]}
                      showClear
                      onBlur={handleModelNameBlur}
                    />
                  </Col>

                  <Col span={24}>
                    <Form.Select
                      field='name_rule'
                      label={t('名称匹配类型')}
                      placeholder={t('请选择名称匹配类型')}
                      optionList={nameRuleOptions.map((o) => ({
                        label: t(o.label),
                        value: o.value,
                      }))}
                      rules={[
                        { required: true, message: t('请选择名称匹配类型') },
                      ]}
                      extraText={t(
                        '根据模型名称和匹配规则查找模型元数据，优先级：精确 > 前缀 > 后缀 > 包含',
                      )}
                      style={{ width: '100%' }}
                    />
                  </Col>

                  <Col span={24}>
                    <Form.Input
                      field='icon'
                      label={t('模型图标')}
                      placeholder={t('请输入图标名称')}
                      extraText={
                        <span>
                          {t(
                            "图标使用@lobehub/icons库，如：OpenAI、Claude.Color，支持链式参数：OpenAI.Avatar.type={'platform'}、OpenRouter.Avatar.shape={'square'}，查询所有可用图标请 ",
                          )}
                          <Typography.Text
                            link={{
                              href: 'https://icons.lobehub.com/components/lobe-hub',
                              target: '_blank',
                            }}
                            icon={<IconLink />}
                            underline
                          >
                            {t('请点击我')}
                          </Typography.Text>
                        </span>
                      }
                      showClear
                    />
                  </Col>

                  <Col span={24}>
                    <Form.TextArea
                      field='description'
                      label={t('描述')}
                      placeholder={t('请输入模型描述')}
                      rows={3}
                      showClear
                    />
                  </Col>

                  <Col span={24}>
                    <Form.InputNumber
                      field='max_concurrency'
                      label={t('全平台最大在途并发限制')}
                      placeholder={t('0 表示不限制')}
                      extraText={t(
                        '限制该模型在全平台允许同时处理的最高在途请求并发数（0 为不限制）',
                      )}
                      min={0}
                      step={1}
                    />
                  </Col>
                  <Col span={24}>
                    <Form.TagInput
                      field='tags'
                      label={t('标签')}
                      placeholder={t('输入标签或使用","分隔多个标签')}
                      addOnBlur
                      showClear
                      onChange={(newTags) => {
                        if (!formApiRef.current) return;
                        const normalize = (tags) => {
                          if (!Array.isArray(tags)) return [];
                          return [
                            ...new Set(
                              tags.flatMap((tag) =>
                                tag
                                  .split(',')
                                  .map((t) => t.trim())
                                  .filter(Boolean),
                              ),
                            ),
                          ];
                        };
                        const normalized = normalize(newTags);
                        formApiRef.current.setValue('tags', normalized);
                      }}
                      style={{ width: '100%' }}
                      {...(tagGroups.length > 0 && {
                        extraText: (
                          <Space wrap>
                            {tagGroups.map((group) => (
                              <Button
                                key={group.id}
                                size='small'
                                type='primary'
                                onClick={() => {
                                  if (formApiRef.current) {
                                    const currentTags =
                                      formApiRef.current.getValue('tags') || [];
                                    const newTags = [
                                      ...currentTags,
                                      ...(group.items || []),
                                    ];
                                    const uniqueTags = [...new Set(newTags)];
                                    formApiRef.current.setValue(
                                      'tags',
                                      uniqueTags,
                                    );
                                  }
                                }}
                              >
                                {group.name}
                              </Button>
                            ))}
                          </Space>
                        ),
                      })}
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Select
                      field='vendor_id'
                      label={t('供应商')}
                      placeholder={t('选择模型供应商')}
                      optionList={vendors.map((v) => ({
                        label: v.name,
                        value: v.id,
                      }))}
                      filter
                      showClear
                      onChange={(value) => {
                        const vendorInfo = vendors.find((v) => v.id === value);
                        if (vendorInfo && formApiRef.current) {
                          formApiRef.current.setValue(
                            'vendor',
                            vendorInfo.name,
                          );
                        }
                      }}
                      style={{ width: '100%' }}
                    />
                  </Col>
                  <Col span={24}>
                    <Banner
                      type='warning'
                      closeIcon={null}
                      icon={
                        <IconAlertTriangle
                          size='large'
                          style={{ color: 'var(--semi-color-warning)' }}
                        />
                      }
                      description={t(
                        '在此管理模型展示、能力与全平台并发限制。在渠道管理中配置上游连接与调度权重。',
                      )}
                      style={{ marginBottom: 12 }}
                    />
                    <JSONEditor
                      field='endpoints'
                      label={t('在模型广场向用户展示的端点')}
                      placeholder={
                        '{\n  "openai": {"path": "/v1/chat/completions", "method": "POST"}\n}'
                      }
                      value={values.endpoints}
                      onChange={(val) =>
                        formApiRef.current?.setValue('endpoints', val)
                      }
                      formApi={formApiRef.current}
                      editorType='object'
                      template={ENDPOINT_TEMPLATE}
                      templateLabel={t('填入模板')}
                      extraText={t('留空则使用默认端点；支持 {path, method}')}
                      extraFooter={
                        endpointGroups.length > 0 && (
                          <Space wrap>
                            {endpointGroups.map((group) => (
                              <Button
                                key={group.id}
                                size='small'
                                type='primary'
                                onClick={() => {
                                  try {
                                    const current =
                                      formApiRef.current?.getValue(
                                        'endpoints',
                                      ) || '';
                                    let base = {};
                                    if (current && current.trim())
                                      base = JSON.parse(current);
                                    const groupObj =
                                      typeof group.items === 'string'
                                        ? JSON.parse(group.items || '{}')
                                        : group.items || {};
                                    const merged = { ...base, ...groupObj };
                                    formApiRef.current?.setValue(
                                      'endpoints',
                                      JSON.stringify(merged, null, 2),
                                    );
                                  } catch (e) {
                                    try {
                                      const groupObj =
                                        typeof group.items === 'string'
                                          ? JSON.parse(group.items || '{}')
                                          : group.items || {};
                                      formApiRef.current?.setValue(
                                        'endpoints',
                                        JSON.stringify(groupObj, null, 2),
                                      );
                                    } catch {}
                                  }
                                }}
                              >
                                {group.name}
                              </Button>
                            ))}
                          </Space>
                        )
                      }
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Switch
                      field='sync_official'
                      label={t('参与官方同步')}
                      extraText={t(
                        '关闭后，此模型将不会被“同步官方”自动覆盖或创建',
                      )}
                      size='large'
                    />
                  </Col>
                  <Col span={24}>
                    <Form.Switch
                      field='status'
                      label={t('状态')}
                      size='large'
                    />
                  </Col>
                </Row>
              </Card>

              {/* 模型定价设置 (方案b: 与系统设置倍率双向绑定) */}
              <ModelPricingSection
                values={values}
                formApi={formApiRef.current}
                isCustomPricing={isCustomPricing}
                hasSystemDefault={hasSystemDefault}
                onResetToDefault={handleResetToDefault}
              />
            </div>
          )}
        </Form>
      </Spin>
    </SideSheet>
  );
};

export default EditModelModal;
