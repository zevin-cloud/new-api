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

import React, { useState, useEffect, useContext, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Button,
  Switch,
  Row,
  Col,
  Typography,
} from '@douyinfe/semi-ui';
import { GripVertical, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { API, showSuccess, showError } from '../../../helpers';
import {
  mergeAdminConfig,
  DEFAULT_SECTION_ORDER,
  DEFAULT_ITEM_ORDERS,
} from '../../../hooks/common/useSidebar';
import { StatusContext } from '../../../context/Status';

const { Text } = Typography;

export default function SettingsSidebarModulesAdmin(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);

  // 左侧边栏模块管理状态（管理员全局控制）
  const [sidebarModulesAdmin, setSidebarModulesAdmin] = useState(() =>
    mergeAdminConfig(null),
  );

  // 同步拖拽引用（避免 React 状态异步导致 dragover 无法识别目标）
  const draggedSectionRef = useRef(null);
  const draggedModuleRef = useRef(null);

  // UI 高亮状态
  const [dragOverSectionKey, setDragOverSectionKey] = useState(null);
  const [dragOverModuleKey, setDragOverModuleKey] = useState(null);
  const [draggingSectionKey, setDraggingSectionKey] = useState(null);
  const [draggingModuleKey, setDraggingModuleKey] = useState(null);

  // 区域移动 (按 Key 交换)
  function moveSection(fromKey, toKey) {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const currentOrder = [
      ...(sidebarModulesAdmin.sectionOrder || DEFAULT_SECTION_ORDER),
    ];
    const fromIndex = currentOrder.indexOf(fromKey);
    const toIndex = currentOrder.indexOf(toKey);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const [moved] = currentOrder.splice(fromIndex, 1);
    currentOrder.splice(toIndex, 0, moved);
    setSidebarModulesAdmin((prev) => ({
      ...prev,
      sectionOrder: currentOrder,
    }));
  }

  // 模块移动 (按 Key 交换)
  function moveModule(sectionKey, fromKey, toKey) {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const currentItems = [
      ...(sidebarModulesAdmin.itemOrders?.[sectionKey] ||
        DEFAULT_ITEM_ORDERS[sectionKey] ||
        []),
    ];
    const fromIndex = currentItems.indexOf(fromKey);
    const toIndex = currentItems.indexOf(toKey);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const [moved] = currentItems.splice(fromIndex, 1);
    currentItems.splice(toIndex, 0, moved);
    setSidebarModulesAdmin((prev) => ({
      ...prev,
      itemOrders: {
        ...(prev.itemOrders || {}),
        [sectionKey]: currentItems,
      },
    }));
  }

  // 微调移动 (▲ / ▼ 方向箭头)
  function shiftSection(sectionKey, direction) {
    const currentOrder = [
      ...(sidebarModulesAdmin.sectionOrder || DEFAULT_SECTION_ORDER),
    ];
    const index = currentOrder.indexOf(sectionKey);
    if (index === -1) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;
    const [moved] = currentOrder.splice(index, 1);
    currentOrder.splice(targetIndex, 0, moved);
    setSidebarModulesAdmin((prev) => ({
      ...prev,
      sectionOrder: currentOrder,
    }));
  }

  function shiftModule(sectionKey, moduleKey, direction) {
    const currentItems = [
      ...(sidebarModulesAdmin.itemOrders?.[sectionKey] ||
        DEFAULT_ITEM_ORDERS[sectionKey] ||
        []),
    ];
    const index = currentItems.indexOf(moduleKey);
    if (index === -1) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentItems.length) return;
    const [moved] = currentItems.splice(index, 1);
    currentItems.splice(targetIndex, 0, moved);
    setSidebarModulesAdmin((prev) => ({
      ...prev,
      itemOrders: {
        ...(prev.itemOrders || {}),
        [sectionKey]: currentItems,
      },
    }));
  }

  // 处理区域级别开关变更
  function handleSectionChange(sectionKey) {
    return (checked) => {
      const newModules = {
        ...sidebarModulesAdmin,
        [sectionKey]: {
          ...sidebarModulesAdmin[sectionKey],
          enabled: checked,
        },
      };
      setSidebarModulesAdmin(newModules);
    };
  }

  // 处理功能级别开关变更
  function handleModuleChange(sectionKey, moduleKey) {
    return (checked) => {
      const newModules = {
        ...sidebarModulesAdmin,
        [sectionKey]: {
          ...sidebarModulesAdmin[sectionKey],
          [moduleKey]: checked,
        },
      };
      setSidebarModulesAdmin(newModules);
    };
  }

  // 重置为默认配置（包含顺序和可见性）
  function resetSidebarModules() {
    setSidebarModulesAdmin(mergeAdminConfig(null));
    showSuccess(t('Reset to default configuration'));
  }

  // 保存配置
  async function onSubmit() {
    setLoading(true);
    try {
      const configToSave = mergeAdminConfig(sidebarModulesAdmin);
      const res = await API.put('/api/option/', {
        key: 'SidebarModulesAdmin',
        value: JSON.stringify(configToSave),
      });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('保存成功'));

        // 立即更新StatusContext中的状态
        statusDispatch({
          type: 'set',
          payload: {
            ...statusState.status,
            SidebarModulesAdmin: JSON.stringify(configToSave),
          },
        });

        // 刷新父组件状态
        if (props.refresh) {
          await props.refresh();
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 从 props.options 中获取配置
    if (props.options && props.options.SidebarModulesAdmin) {
      try {
        const modules = JSON.parse(props.options.SidebarModulesAdmin);
        setSidebarModulesAdmin(mergeAdminConfig(modules));
      } catch (error) {
        // 使用默认配置
        setSidebarModulesAdmin(mergeAdminConfig(null));
      }
    }
  }, [props.options]);

  // 基础区域配置数据
  const baseSectionConfigs = [
    {
      key: 'overview',
      title: t('Operations overview'),
      description: t('System data and runtime status'),
      modules: [
        {
          key: 'detail',
          title: t('数据看板'),
          description: t('系统数据统计与运行分析'),
        },
      ],
    },
    {
      key: 'resources',
      title: t('Model resources'),
      description: t('Upstream channels, model registry and debugging'),
      modules: [
        {
          key: 'channel',
          title: t('渠道管理'),
          description: t('API渠道配置与密钥管理'),
        },
        {
          key: 'models',
          title: t('模型管理'),
          description: t('AI模型映射与属性配置'),
        },
        {
          key: 'model_set',
          title: t('模型集管理'),
          description: t('业务模型组合管理'),
        },
        {
          key: 'deployment',
          title: t('模型部署'),
          description: t('私有模型部署与实例管理'),
        },
        {
          key: 'playground',
          title: t('操练场'),
          description: t('AI模型在线测试与调试环境'),
        },
      ],
    },
    {
      key: 'governance',
      title: t('Access governance'),
      description: t('Permissions, users and access keys'),
      modules: [
        {
          key: 'model_grant',
          title: t('授权管理'),
          description: t('模型准入、预算与策略授权管理'),
        },
        {
          key: 'user',
          title: t('用户管理'),
          description: t('企业员工与系统用户管理'),
        },
        {
          key: 'user_group',
          title: t('用户组管理'),
          description: t('组织架构、部门与用户组管理'),
        },
        {
          key: 'token',
          title: t('API Key management'),
          description: t('API访问凭证与密钥生命周期管理'),
        },
      ],
    },
    {
      key: 'audit',
      title: t('Logs and audit'),
      description: t('Invocation traces and task records'),
      modules: [
        {
          key: 'log',
          title: t('Invocation logs'),
          description: t('模型API调用明细与消费记录'),
        },
        {
          key: 'midjourney',
          title: t('绘图日志'),
          description: t('Midjourney绘图生成任务记录'),
        },
        {
          key: 'task',
          title: t('任务日志'),
          description: t('音视频等异步长周期任务记录'),
        },
      ],
    },
    {
      key: 'system',
      title: t('System configuration'),
      description: t('Platform settings and options'),
      modules: [
        {
          key: 'setting',
          title: t('系统设置'),
          description: t('平台全局参数与功能开关配置'),
        },
      ],
    },
  ];

  const currentSectionOrder =
    sidebarModulesAdmin.sectionOrder || DEFAULT_SECTION_ORDER;
  const currentItemOrders =
    sidebarModulesAdmin.itemOrders || DEFAULT_ITEM_ORDERS;

  // 根据当前 sectionOrder 排序
  const sortedSectionConfigs = [...baseSectionConfigs].sort((a, b) => {
    const aIdx = currentSectionOrder.indexOf(a.key);
    const bIdx = currentSectionOrder.indexOf(b.key);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  return (
    <Card>
      <Form.Section
        text={t('侧边栏管理（全局控制）')}
        extraText={t(
          'Globally control sidebar sections and modules display, drag handles or use arrows to reorder',
        )}
      >
        {sortedSectionConfigs.map((section, secIndex) => {
          const itemOrder = currentItemOrders[section.key] || [];
          const sortedModules = [...section.modules].sort((a, b) => {
            const aIdx = itemOrder.indexOf(a.key);
            const bIdx = itemOrder.indexOf(b.key);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
          });

          return (
            <div
              key={section.key}
              onDragOver={(e) => {
                if (draggedSectionRef.current) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverSectionKey !== section.key) {
                    setDragOverSectionKey(section.key);
                  }
                }
              }}
              onDragLeave={(e) => {
                if (dragOverSectionKey === section.key) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (
                    e.clientX < rect.left ||
                    e.clientX >= rect.right ||
                    e.clientY < rect.top ||
                    e.clientY >= rect.bottom
                  ) {
                    setDragOverSectionKey(null);
                  }
                }
              }}
              onDrop={(e) => {
                const sourceKey = draggedSectionRef.current;
                if (sourceKey) {
                  e.preventDefault();
                  moveSection(sourceKey, section.key);
                  draggedSectionRef.current = null;
                  setDraggingSectionKey(null);
                  setDragOverSectionKey(null);
                }
              }}
              style={{
                marginBottom: '28px',
                borderRadius: '8px',
                padding: '4px',
                border:
                  dragOverSectionKey === section.key &&
                  draggingSectionKey !== section.key
                    ? '2px dashed var(--semi-color-primary)'
                    : '2px solid transparent',
                backgroundColor:
                  dragOverSectionKey === section.key &&
                  draggingSectionKey !== section.key
                    ? 'var(--semi-color-primary-light-default)'
                    : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              {/* 区域标题、拖拽手柄、排序微调和总开关 */}
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', `section:${section.key}`);
                  e.dataTransfer.effectAllowed = 'move';
                  draggedSectionRef.current = section.key;
                  setDraggingSectionKey(section.key);
                }}
                onDragEnd={() => {
                  draggedSectionRef.current = null;
                  setDraggingSectionKey(null);
                  setDragOverSectionKey(null);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  padding: '12px 16px',
                  backgroundColor: 'var(--semi-color-fill-0)',
                  borderRadius: '8px',
                  border: '1px solid var(--semi-color-border)',
                  opacity: draggingSectionKey === section.key ? 0.3 : 1,
                  cursor: 'grab',
                  transition: 'all 0.2s',
                  userSelect: 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      cursor: 'grab',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--semi-color-text-2)',
                      padding: '4px',
                      pointerEvents: 'none',
                    }}
                    title={t('Drag to reorder section')}
                  >
                    <GripVertical size={18} style={{ pointerEvents: 'none' }} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: '600',
                        fontSize: '16px',
                        color: 'var(--semi-color-text-0)',
                        marginBottom: '4px',
                      }}
                    >
                      {section.title}
                    </div>
                    <Text
                      type='secondary'
                      size='small'
                      style={{
                        fontSize: '12px',
                        color: 'var(--semi-color-text-2)',
                        lineHeight: '1.4',
                      }}
                    >
                      {section.description}
                    </Text>
                  </div>
                </div>
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  draggable={false}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'default',
                  }}
                >
                  <Button
                    icon={<ChevronUp size={16} />}
                    theme='borderless'
                    size='small'
                    disabled={secIndex === 0}
                    onClick={() => shiftSection(section.key, -1)}
                    title={t('Move section up')}
                    aria-label={`上移${section.title}`}
                  />
                  <Button
                    icon={<ChevronDown size={16} />}
                    theme='borderless'
                    size='small'
                    disabled={secIndex === sortedSectionConfigs.length - 1}
                    onClick={() => shiftSection(section.key, 1)}
                    title={t('Move section down')}
                    aria-label={`下移${section.title}`}
                  />
                  <div
                    style={{
                      width: '1px',
                      height: '16px',
                      background: 'var(--semi-color-border)',
                      margin: '0 4px',
                    }}
                  />
                  <Switch
                    checked={sidebarModulesAdmin[section.key]?.enabled}
                    onChange={handleSectionChange(section.key)}
                    size='default'
                  />
                </div>
              </div>

              {/* 功能模块网格（支持卡片内拖拽排序与微调） */}
              <Row gutter={[16, 16]}>
                {sortedModules.map((module, modIndex) => {
                  const isModDragging = draggingModuleKey === module.key;
                  const isModDragOver =
                    dragOverModuleKey === module.key &&
                    draggingModuleKey !== module.key;

                  return (
                    <Col
                      key={module.key}
                      xs={24}
                      sm={12}
                      md={8}
                      lg={6}
                      xl={6}
                    >
                      <div
                        draggable={sidebarModulesAdmin[section.key]?.enabled}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData(
                            'text/plain',
                            `module:${section.key}:${module.key}`,
                          );
                          e.dataTransfer.effectAllowed = 'move';
                          draggedModuleRef.current = {
                            sectionKey: section.key,
                            moduleKey: module.key,
                          };
                          setDraggingModuleKey(module.key);
                        }}
                        onDragOver={(e) => {
                          const currentSource = draggedModuleRef.current;
                          if (
                            currentSource &&
                            currentSource.sectionKey === section.key
                          ) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverModuleKey !== module.key) {
                              setDragOverModuleKey(module.key);
                            }
                          }
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          if (dragOverModuleKey === module.key) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (
                              e.clientX < rect.left ||
                              e.clientX >= rect.right ||
                              e.clientY < rect.top ||
                              e.clientY >= rect.bottom
                            ) {
                              setDragOverModuleKey(null);
                            }
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const currentSource = draggedModuleRef.current;
                          if (
                            currentSource &&
                            currentSource.sectionKey === section.key &&
                            currentSource.moduleKey !== module.key
                          ) {
                            moveModule(
                              section.key,
                              currentSource.moduleKey,
                              module.key,
                            );
                          }
                          draggedModuleRef.current = null;
                          setDraggingModuleKey(null);
                          setDragOverModuleKey(null);
                        }}
                        onDragEnd={() => {
                          draggedModuleRef.current = null;
                          setDraggingModuleKey(null);
                          setDragOverModuleKey(null);
                        }}
                        style={{
                          userSelect: 'none',
                          cursor: sidebarModulesAdmin[section.key]?.enabled
                            ? 'grab'
                            : 'not-allowed',
                        }}
                      >
                        <Card
                          bodyStyle={{ padding: '12px 14px' }}
                          hoverable
                          style={{
                            opacity: !sidebarModulesAdmin[section.key]?.enabled
                              ? 0.4
                              : isModDragging
                              ? 0.3
                              : 1,
                            border: isModDragOver
                              ? '2px dashed var(--semi-color-primary)'
                              : '1px solid var(--semi-color-border)',
                            backgroundColor: isModDragOver
                              ? 'var(--semi-color-primary-light-default)'
                              : 'var(--semi-color-bg-2)',
                            transition: 'all 0.2s',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              minHeight: '48px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                flex: 1,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  color: 'var(--semi-color-text-3)',
                                  marginRight: '8px',
                                  marginTop: '2px',
                                  flexShrink: 0,
                                  pointerEvents: 'none',
                                }}
                                title={t('Drag to reorder module')}
                              >
                                <GripVertical
                                  size={14}
                                  style={{ pointerEvents: 'none' }}
                                />
                              </div>
                              <div
                                style={{
                                  flex: 1,
                                  textAlign: 'left',
                                  minWidth: 0,
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    color: 'var(--semi-color-text-0)',
                                    marginBottom: '2px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {module.title}
                                </div>
                                <Text
                                  type='secondary'
                                  size='small'
                                  style={{
                                    fontSize: '12px',
                                    color: 'var(--semi-color-text-2)',
                                    lineHeight: '1.3',
                                    display: 'block',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                  title={module.description}
                                >
                                  {module.description}
                                </Text>
                              </div>
                            </div>
                            <div
                              onMouseDown={(e) => e.stopPropagation()}
                              draggable={false}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                marginLeft: '8px',
                                flexShrink: 0,
                                cursor: 'default',
                              }}
                            >
                              <Button
                                icon={<ChevronUp size={14} />}
                                theme='borderless'
                                size='small'
                                disabled={
                                  modIndex === 0 ||
                                  !sidebarModulesAdmin[section.key]?.enabled
                                }
                                onClick={() =>
                                  shiftModule(section.key, module.key, -1)
                                }
                                title={t('Move up')}
                                aria-label={`上移${module.title}`}
                              />
                              <Button
                                icon={<ChevronDown size={14} />}
                                theme='borderless'
                                size='small'
                                disabled={
                                  modIndex === sortedModules.length - 1 ||
                                  !sidebarModulesAdmin[section.key]?.enabled
                                }
                                onClick={() =>
                                  shiftModule(section.key, module.key, 1)
                                }
                                title={t('Move down')}
                                aria-label={`下移${module.title}`}
                              />
                              <Switch
                                checked={
                                  sidebarModulesAdmin[section.key]?.[
                                    module.key
                                  ]
                                }
                                onChange={handleModuleChange(
                                  section.key,
                                  module.key,
                                )}
                                size='default'
                                disabled={
                                  !sidebarModulesAdmin[section.key]?.enabled
                                }
                              />
                            </div>
                          </div>
                        </Card>
                      </div>
                    </Col>
                  );
                })}
              </Row>
            </div>
          );
        })}

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-start',
            alignItems: 'center',
            paddingTop: '8px',
            borderTop: '1px solid var(--semi-color-border)',
          }}
        >
          <Button
            size='default'
            type='tertiary'
            icon={<RotateCcw size={15} />}
            onClick={resetSidebarModules}
            style={{
              borderRadius: '6px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {t('Reset to default configuration')}
          </Button>
          <Button
            size='default'
            type='primary'
            onClick={onSubmit}
            loading={loading}
            style={{
              borderRadius: '6px',
              fontWeight: '500',
              minWidth: '100px',
            }}
          >
            {t('保存设置')}
          </Button>
        </div>
      </Form.Section>
    </Card>
  );
}
