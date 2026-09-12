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

import React, { useEffect, useState, useContext } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Row,
  Switch,
  Typography,
} from '@douyinfe/semi-ui';
import { API, setStatusData, showError, showSuccess } from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../../context/Status';

const { Text } = Typography;

export default function SettingsHeaderNavModules(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);

  // 顶栏模块管理状态
  const [headerNavModules, setHeaderNavModules] = useState({
    home: false,
    console: true,
    pricing: {
      enabled: true,
      requireAuth: false, // 默认不需要登录鉴权
    },
    docs: true,
    about: true,
  });

  // 持久化保存顶栏模块配置并实时同步全局状态和本地缓存
  const persistModules = async (modulesToSave, showToast = true) => {
    try {
      const payloadStr = JSON.stringify(modulesToSave);
      const res = await API.put('/api/option/', {
        key: 'HeaderNavModules',
        value: payloadStr,
      });
      const { success, message } = res.data;
      if (success) {
        if (showToast) {
          showSuccess(t('已保存'));
        }

        const nextStatus = {
          ...(statusState?.status || {}),
          HeaderNavModules: payloadStr,
        };

        statusDispatch({
          type: 'set',
          payload: nextStatus,
        });
        setStatusData(nextStatus);

        if (props.refresh) {
          props.refresh();
        }
        return true;
      } else {
        showError(message);
        return false;
      }
    } catch (error) {
      showError(t('保存失败，请重试'));
      return false;
    }
  };

  // 处理顶栏模块配置变更（立即保存生效）
  function handleHeaderNavModuleChange(moduleKey) {
    return (checked) => {
      const newModules = { ...headerNavModules };
      if (moduleKey === 'pricing') {
        newModules[moduleKey] = {
          ...newModules[moduleKey],
          enabled: checked,
        };
      } else {
        newModules[moduleKey] = checked;
      }
      setHeaderNavModules(newModules);
      persistModules(newModules, true);
    };
  }

  // 处理模型广场权限控制变更（立即保存生效）
  function handlePricingAuthChange(checked) {
    const newModules = { ...headerNavModules };
    newModules.pricing = {
      ...newModules.pricing,
      requireAuth: checked,
    };
    setHeaderNavModules(newModules);
    persistModules(newModules, true);
  }

  // 重置顶栏模块为默认配置
  async function resetHeaderNavModules() {
    const defaultModules = {
      home: false,
      console: true,
      pricing: {
        enabled: true,
        requireAuth: false,
      },
      docs: true,
      about: true,
    };
    setHeaderNavModules(defaultModules);
    await persistModules(defaultModules, false);
    showSuccess(t('已重置为默认配置'));
  }

  // 手动保存配置
  async function onSubmit() {
    setLoading(true);
    try {
      await persistModules(headerNavModules, true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // 优先从 props.options 读取，其次使用 statusState
    const rawConfig =
      (props.options && props.options.HeaderNavModules) ||
      statusState?.status?.HeaderNavModules;

    if (rawConfig) {
      try {
        const modules =
          typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;

        if (typeof modules.pricing === 'boolean') {
          modules.pricing = {
            enabled: modules.pricing,
            requireAuth: false,
          };
        }

        setHeaderNavModules((prev) => ({
          ...prev,
          ...modules,
        }));
      } catch (error) {
        // 保留当前状态
      }
    }
  }, [props.options, statusState?.status?.HeaderNavModules]);

  // 模块配置数据
  const moduleConfigs = [
    {
      key: 'home',
      title: t('首页'),
      description: t('系统主页展示'),
    },
    {
      key: 'console',
      title: t('Management console'),
      description: t('用户控制面板，管理账户'),
    },
    {
      key: 'pricing',
      title: t('模型广场'),
      description: t('模型定价，需要登录访问'),
      hasSubConfig: true, // 标识该模块有子配置
    },
    {
      key: 'docs',
      title: t('Integration docs'),
      description: t('系统文档和帮助信息'),
    },
    {
      key: 'about',
      title: t('关于'),
      description: t('关于系统的详细信息'),
    },
  ];

  return (
    <Card>
      <Form.Section
        text={t('顶栏管理')}
        extraText={t('控制顶栏模块显示状态，全局生效')}
      >
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          {moduleConfigs.map((module) => (
            <Col
              key={module.key}
              xs={24}
              sm={12}
              md={module.hasSubConfig ? 12 : 6}
              lg={module.hasSubConfig ? 12 : 6}
              xl={module.hasSubConfig ? 8 : 4}
            >
              <Card
                style={{
                  borderRadius: '8px',
                  border: '1px solid var(--semi-color-border)',
                  transition: 'all 0.2s ease',
                  background: 'var(--semi-color-bg-1)',
                  minHeight: '80px',
                }}
                bodyStyle={{ padding: '16px' }}
                hoverable
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div
                      style={{
                        fontWeight: '600',
                        fontSize: '14px',
                        color: 'var(--semi-color-text-0)',
                        marginBottom: '4px',
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
                        lineHeight: '1.4',
                        display: 'block',
                      }}
                    >
                      {module.description}
                    </Text>
                  </div>
                  <div style={{ marginLeft: '16px' }}>
                    <Switch
                      checked={
                        module.key === 'pricing'
                          ? headerNavModules[module.key]?.enabled
                          : headerNavModules[module.key]
                      }
                      onChange={handleHeaderNavModuleChange(module.key)}
                      size='default'
                    />
                  </div>
                </div>

                {/* 为模型广场添加权限控制子开关 */}
                {module.key === 'pricing' &&
                  (module.key === 'pricing'
                    ? headerNavModules[module.key]?.enabled
                    : headerNavModules[module.key]) && (
                    <div
                      style={{
                        borderTop: '1px solid var(--semi-color-border)',
                        marginTop: '12px',
                        paddingTop: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <div
                            style={{
                              fontWeight: '500',
                              fontSize: '12px',
                              color: 'var(--semi-color-text-1)',
                              marginBottom: '2px',
                            }}
                          >
                            {t('需要登录访问')}
                          </div>
                          <Text
                            type='secondary'
                            size='small'
                            style={{
                              fontSize: '11px',
                              color: 'var(--semi-color-text-2)',
                              lineHeight: '1.4',
                              display: 'block',
                            }}
                          >
                            {t('开启后未登录用户无法访问模型广场')}
                          </Text>
                        </div>
                        <div style={{ marginLeft: '16px' }}>
                          <Switch
                            checked={
                              headerNavModules.pricing?.requireAuth || false
                            }
                            onChange={handlePricingAuthChange}
                            size='default'
                          />
                        </div>
                      </div>
                    </div>
                  )}
              </Card>
            </Col>
          ))}
        </Row>

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
            onClick={resetHeaderNavModules}
            style={{
              borderRadius: '6px',
              fontWeight: '500',
            }}
          >
            {t('重置为默认')}
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
