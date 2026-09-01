/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Input,
  Button,
  Checkbox,
  Tag,
  Typography,
  Space,
  Empty,
  Badge,
} from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import {
  IconSearch,
  IconCheckList,
  IconDelete,
  IconCheckboxTick,
  IconLayers,
  IconGridSquare,
  IconGlobe,
  IconAppCenter,
  IconBolt,
} from '@douyinfe/semi-icons';
import { getModelCategories } from '../../../../helpers/render';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const ModelCategoryPickerModal = ({
  visible,
  onClose,
  onConfirm,
  initialSelected = [],
  configuredModels = [],
  allPresetModels = [],
  t,
}) => {
  const isMobile = useIsMobile();
  const [selectedSet, setSelectedSet] = useState(new Set());
  const [activeCategory, setActiveCategory] = useState('all_configured');
  const [searchKeyword, setSearchKeyword] = useState('');

  // 初始化已选模型
  useEffect(() => {
    if (visible) {
      setSelectedSet(new Set(initialSelected || []));
      setSearchKeyword('');
      if (configuredModels.length > 0) {
        setActiveCategory('all_configured');
      } else {
        setActiveCategory('all');
      }
    }
  }, [visible, initialSelected, configuredModels]);

  // 全量合并模型列表
  const allMergedModels = useMemo(() => {
    const set = new Set([...configuredModels, ...allPresetModels]);
    const list = Array.from(set).filter(Boolean);
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [configuredModels, allPresetModels]);

  const configuredModelSet = useMemo(() => {
    return new Set(configuredModels);
  }, [configuredModels]);

  // 分类数据生成
  const categoriesData = useMemo(() => {
    const rawCategories = getModelCategories(t);
    const result = {};

    // 1. 平台已配置可用模型
    result['all_configured'] = {
      key: 'all_configured',
      label: t('平台已配置/可用'),
      icon: <IconBolt className='text-[var(--semi-color-primary)]' />,
      models: configuredModels,
    };

    // 2. 按官方提供商分类
    Object.entries(rawCategories).forEach(([key, cat]) => {
      if (key === 'all') return;
      const matched = allMergedModels.filter((m) =>
        cat.filter?.({ model_name: m }),
      );
      if (matched.length > 0) {
        result[key] = {
          key,
          label: cat.label,
          icon: cat.icon || <IconLayers />,
          models: matched,
        };
      }
    });

    // 3. 其他/未归类
    const categorizedModels = new Set();
    Object.values(result).forEach((cat) => {
      if (cat.key !== 'all_configured') {
        cat.models.forEach((m) => categorizedModels.add(m));
      }
    });

    const others = allMergedModels.filter((m) => !categorizedModels.has(m));
    if (others.length > 0) {
      result['other'] = {
        key: 'other',
        label: t('其他/自定义模型'),
        icon: <IconAppCenter />,
        models: others,
      };
    }

    // 4. 全部模型
    result['all'] = {
      key: 'all',
      label: t('全部可用与预置模型'),
      icon: <IconGridSquare />,
      models: allMergedModels,
    };

    return result;
  }, [allMergedModels, configuredModels, t]);

  // 当前分类下的模型列表
  const currentCategoryModels = useMemo(() => {
    const cat = categoriesData[activeCategory];
    const list = cat?.models || [];
    if (!searchKeyword.trim()) return list;
    const kw = searchKeyword.trim().toLowerCase();
    return list.filter((m) => m.toLowerCase().includes(kw));
  }, [categoriesData, activeCategory, searchKeyword]);

  // 切换选中单个模型
  const toggleModel = (model) => {
    const next = new Set(selectedSet);
    if (next.has(model)) {
      next.delete(model);
    } else {
      next.add(model);
    }
    setSelectedSet(next);
  };

  // 全选当前分类
  const handleSelectCurrentCategory = () => {
    const next = new Set(selectedSet);
    currentCategoryModels.forEach((m) => next.add(m));
    setSelectedSet(next);
  };

  // 取消全选当前分类
  const handleDeselectCurrentCategory = () => {
    const next = new Set(selectedSet);
    currentCategoryModels.forEach((m) => next.delete(m));
    setSelectedSet(next);
  };

  // 清空全部
  const handleClearAll = () => {
    setSelectedSet(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedSet));
    onClose();
  };

  return (
    <Modal
      title={
        <div className='flex items-center justify-between pr-8 w-full'>
          <div className='flex items-center gap-2'>
            <Typography.Text strong className='text-base'>
              {t('选择模型')}
            </Typography.Text>
            <Tag color='blue' size='small'>
              {t('已选 {{count}} 个', { count: selectedSet.size })}
            </Tag>
          </div>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      onOk={handleConfirm}
      okText={t('确认选择 ({{count}})', { count: selectedSet.size })}
      cancelText={t('取消')}
      width={860}
      className='!rounded-xl'
      bodyStyle={{ padding: 0 }}
      destroyOnClose
    >
      <div className='flex flex-col h-[520px]'>
        {/* 顶部搜索与快捷操作 */}
        <div className='flex flex-wrap items-center justify-between gap-2 p-3 border-b border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)]'>
          <Input
            placeholder={t('搜索模型名称...')}
            value={searchKeyword}
            onChange={(v) => setSearchKeyword(v)}
            prefix={<IconSearch />}
            showClear
            style={{ width: isMobile ? '100%' : 260 }}
          />

          <Space wrap>
            <Button
              size='small'
              type='tertiary'
              theme='light'
              onClick={handleSelectCurrentCategory}
              disabled={currentCategoryModels.length === 0}
            >
              {t('全选当前分类 ({{count}})', {
                count: currentCategoryModels.length,
              })}
            </Button>
            <Button
              size='small'
              type='tertiary'
              theme='light'
              onClick={handleDeselectCurrentCategory}
              disabled={currentCategoryModels.length === 0}
            >
              {t('取消全选当前')}
            </Button>
            <Button
              size='small'
              type='danger'
              theme='borderless'
              onClick={handleClearAll}
              disabled={selectedSet.size === 0}
            >
              {t('清空全部已选')}
            </Button>
          </Space>
        </div>

        {/* 主体两栏布局：左侧分类，右侧模型多选 */}
        <div className='flex flex-1 min-h-0'>
          {/* 左侧分类导航 */}
          <div className='w-48 sm:w-56 border-r border-[var(--semi-color-border)] overflow-y-auto bg-[var(--semi-color-bg-1)] p-2 flex flex-col gap-1'>
            {Object.values(categoriesData).map((cat) => {
              const isActive = activeCategory === cat.key;
              const selectedCountInCat = cat.models.filter((m) =>
                selectedSet.has(m),
              ).length;

              return (
                <button
                  key={cat.key}
                  type='button'
                  onClick={() => setActiveCategory(cat.key)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer border-none ${
                    isActive
                      ? 'bg-[var(--semi-color-primary-light-default)] text-[var(--semi-color-primary)] font-medium shadow-sm'
                      : 'bg-transparent text-[var(--semi-color-text-0)] hover:bg-[var(--semi-color-fill-0)]'
                  }`}
                >
                  <div className='flex items-center gap-1.5 truncate'>
                    <span className='text-base flex-shrink-0'>{cat.icon}</span>
                    <span className='truncate'>{cat.label}</span>
                  </div>
                  <div className='flex items-center gap-1 flex-shrink-0 ml-1'>
                    {selectedCountInCat > 0 && (
                      <span className='px-1.5 py-0.5 rounded-full text-[10px] bg-[var(--semi-color-primary)] text-white font-bold'>
                        {selectedCountInCat}
                      </span>
                    )}
                    <span className='text-xs text-[var(--semi-color-text-2)]'>
                      {cat.models.length}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 右侧模型列表 */}
          <div className='flex-1 p-3 overflow-y-auto'>
            {currentCategoryModels.length === 0 ? (
              <div className='h-full flex items-center justify-center'>
                <Empty
                  image={
                    <IllustrationNoResult style={{ width: 120, height: 120 }} />
                  }
                  darkModeImage={
                    <IllustrationNoResultDark
                      style={{ width: 120, height: 120 }}
                    />
                  }
                  description={
                    searchKeyword
                      ? t('未搜索到相关模型')
                      : t('该分类下暂无模型')
                  }
                />
              </div>
            ) : (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                {currentCategoryModels.map((model) => {
                  const isChecked = selectedSet.has(model);
                  const isConfigured = configuredModelSet.has(model);

                  return (
                    <div
                      key={model}
                      onClick={() => toggleModel(model)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                        isChecked
                          ? 'border-[var(--semi-color-primary)] bg-[var(--semi-color-primary-light-default)]'
                          : 'border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] hover:border-[var(--semi-color-primary-light-active)]'
                      }`}
                    >
                      <div className='flex items-center gap-2 min-w-0 pr-2'>
                        <Checkbox
                          checked={isChecked}
                          onChange={() => {}} // handled by card onClick
                        />
                        <Typography.Text
                          strong={isChecked}
                          className='text-sm truncate !text-[var(--semi-color-text-0)]'
                          title={model}
                        >
                          {model}
                        </Typography.Text>
                      </div>

                      {isConfigured ? (
                        <Tag
                          color='green'
                          size='small'
                          className='flex-shrink-0 !text-[11px]'
                        >
                          {t('平台可用')}
                        </Tag>
                      ) : (
                        <Tag
                          color='grey'
                          size='small'
                          className='flex-shrink-0 !text-[11px]'
                        >
                          {t('预置')}
                        </Tag>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 底部已选预览栏 */}
        {selectedSet.size > 0 && (
          <div className='p-2.5 border-t border-[var(--semi-color-border)] bg-[var(--semi-color-fill-0)] max-h-24 overflow-y-auto flex flex-wrap gap-1.5 items-center'>
            <span className='text-xs text-[var(--semi-color-text-2)] mr-1'>
              {t('已选模型 ({{count}}):', { count: selectedSet.size })}
            </span>
            {Array.from(selectedSet).map((m) => (
              <Tag
                key={m}
                color='blue'
                closable
                onClose={() => toggleModel(m)}
                size='small'
              >
                {m}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ModelCategoryPickerModal;
