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

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Typography } from '@douyinfe/semi-ui';
import {
  Settings,
  Lock,
  CreditCard,
  Cpu,
  Shield,
  LayoutDashboard,
  Zap,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  PanelLeft,
} from 'lucide-react';
import { getLogo, getSystemName } from '../../helpers';

const { Text } = Typography;

const NAV_GROUPS = (t) => [
  {
    key: 'site',
    label: t('站点与品牌'),
    icon: Settings,
    items: [
      { key: 'general', label: t('系统信息') },
      { key: 'notice', label: t('系统公告') },
      { key: 'topnav', label: t('顶栏管理') },
      { key: 'sidebar', label: t('侧边栏模块') },
    ],
  },
  {
    key: 'auth',
    label: t('身份验证'),
    icon: Lock,
    items: [
      { key: 'login', label: t('基本身份验证') },
      { key: 'oauth', label: t('OAuth 集成') },
      { key: 'passkey', label: t('通行密钥认证') },
      { key: 'captcha', label: t('机器人保护') },
      { key: 'custom-oauth', label: t('自定义 OAuth') },
    ],
  },
  {
    key: 'billing',
    label: t('计费与支付'),
    icon: CreditCard,
    items: [
      { key: 'payment', label: t('支付设置') },
    ],
  },
  {
    key: 'model',
    label: t('模型与路由'),
    icon: Cpu,
    items: [
      { key: 'models', label: t('模型相关设置') },
      { key: 'model-deployment', label: t('模型部署设置') },
      { key: 'ratio', label: t('路由核算设置') },
      { key: 'chats', label: t('聊天设置') },
      { key: 'drawing', label: t('绘图设置') },
    ],
  },
  {
    key: 'security',
    label: t('安全与限制'),
    icon: Shield,
    items: [
      { key: 'ratelimit', label: t('速率限制') },
      { key: 'sensitive', label: t('敏感词过滤') },
      { key: 'credit', label: t('额度设置') },
    ],
  },
  {
    key: 'console',
    label: t('控制台内容'),
    icon: LayoutDashboard,
    items: [
      { key: 'operation', label: t('运营通用') },
      { key: 'dashboard', label: t('仪表盘') },
      { key: 'log', label: t('日志') },
      { key: 'monitor', label: t('监控') },
      { key: 'checkin', label: t('签到') },
    ],
  },
  {
    key: 'performance',
    label: t('性能与缓存'),
    icon: Zap,
    items: [
      { key: 'performance', label: t('性能设置') },
    ],
  },
];

export default function SettingsNav({
  activeItem,
  onSelect,
  collapsed = false,
  onToggleCollapse,
}) {
  const { t } = useTranslation();
  const groups = NAV_GROUPS(t);
  const logo = getLogo() || '/logo.png';
  const systemName = getSystemName() || 'New API';

  // Default collapsed: only the active group is expanded
  const [expanded, setExpanded] = useState(() => {
    const init = {};
    groups.forEach((g) => {
      init[g.key] = g.items.some((i) => i.key === activeItem);
    });
    return init;
  });

  // Ensure active group is opened when activeItem changes
  useEffect(() => {
    const activeGroup = groups.find((g) =>
      g.items.some((i) => i.key === activeItem)
    );
    if (activeGroup) {
      setExpanded((prev) => ({
        ...prev,
        [activeGroup.key]: true,
      }));
    }
  }, [activeItem]);

  function toggleGroup(key) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div
      style={{
        width: collapsed ? '60px' : '220px',
        minWidth: collapsed ? '60px' : '220px',
        flexShrink: 0,
        borderRight: '1px solid var(--semi-color-border)',
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingBottom: '24px',
        background: 'var(--semi-color-bg-0)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        userSelect: 'none',
      }}
    >
      {/* Top Brand & Toggle Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: '10px',
          padding: '14px 14px 10px 14px',
          minHeight: '52px',
        }}
      >
        <div
          onClick={onToggleCollapse}
          title={collapsed ? t('展开侧边栏') : t('折叠侧边栏')}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            color: 'var(--semi-color-text-1)',
            flexShrink: 0,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--semi-color-fill-0)';
            e.currentTarget.style.color = 'var(--semi-color-text-0)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--semi-color-text-1)';
          }}
        >
          <PanelLeft size={18} />
        </div>

        {!collapsed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <img
              src={logo}
              alt='logo'
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                objectFit: 'contain',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontWeight: 600,
                fontSize: '15px',
                color: 'var(--semi-color-text-0)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {systemName}
            </span>
          </div>
        )}
      </div>

      {/* Return to Console Link */}
      <div style={{ padding: collapsed ? '4px 8px' : '4px 12px' }}>
        <Link
          to='/console'
          title={t('返回控制台')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '6px',
            color: 'var(--semi-color-text-0)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--semi-color-fill-0)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <ChevronLeft size={16} style={{ flexShrink: 0 }} />
          {!collapsed && <span>{t('返回控制台')}</span>}
        </Link>
      </div>

      {/* Horizontal Divider */}
      <div
        style={{
          height: '1px',
          background: 'var(--semi-color-border)',
          margin: collapsed ? '6px 8px 10px 8px' : '6px 12px 10px 12px',
        }}
      />

      {/* Section Title */}
      {!collapsed && (
        <div style={{ padding: '0 16px 6px 16px' }}>
          <Text
            type='tertiary'
            size='small'
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--semi-color-text-2)',
            }}
          >
            {t('系统管理')}
          </Text>
        </div>
      )}

      {/* Navigation Groups */}
      <div style={{ flex: 1 }}>
        {groups.map((group) => {
          const Icon = group.icon;
          const isOpen = expanded[group.key];
          const isGroupActive = group.items.some((i) => i.key === activeItem);

          if (collapsed) {
            return (
              <div
                key={group.key}
                onClick={() => {
                  if (onToggleCollapse) onToggleCollapse();
                  toggleGroup(group.key);
                }}
                title={group.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '9px 0',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  margin: '2px 8px',
                  color: isGroupActive
                    ? 'var(--semi-color-primary)'
                    : 'var(--semi-color-text-1)',
                  background: isGroupActive
                    ? 'var(--semi-color-primary-light-default)'
                    : 'transparent',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon size={16} />
              </div>
            );
          }

          return (
            <div key={group.key} style={{ marginBottom: '2px' }}>
              {/* Group header */}
              <div
                onClick={() => toggleGroup(group.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 12px 7px 14px',
                  cursor: 'pointer',
                  color: isGroupActive
                    ? 'var(--semi-color-primary)'
                    : 'var(--semi-color-text-0)',
                  fontWeight: 500,
                  fontSize: '13px',
                  borderRadius: '6px',
                  margin: '1px 8px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--semi-color-fill-0)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon size={15} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{group.label}</span>
                {isOpen ? (
                  <ChevronDown
                    size={14}
                    style={{ flexShrink: 0, color: 'var(--semi-color-text-2)' }}
                  />
                ) : (
                  <ChevronRight
                    size={14}
                    style={{ flexShrink: 0, color: 'var(--semi-color-text-2)' }}
                  />
                )}
              </div>

              {/* Sub-items with vertical guide line */}
              {isOpen && (
                <div
                  style={{
                    marginLeft: '21px',
                    paddingLeft: '8px',
                    borderLeft: '1px solid var(--semi-color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    marginTop: '2px',
                    marginBottom: '4px',
                  }}
                >
                  {group.items.map((item) => {
                    const isActive = item.key === activeItem;
                    return (
                      <div
                        key={item.key}
                        onClick={() => onSelect(item.key)}
                        style={{
                          padding: '6px 14px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          borderRadius: '20px',
                          color: isActive
                            ? 'var(--semi-color-primary)'
                            : 'var(--semi-color-text-0)',
                          background: isActive
                            ? 'var(--semi-color-primary-light-default)'
                            : 'transparent',
                          fontWeight: isActive ? 500 : 400,
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background =
                              'var(--semi-color-fill-0)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
