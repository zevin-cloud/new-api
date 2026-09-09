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

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@douyinfe/semi-ui';
import {
  Globe,
  Lock,
  CreditCard,
  Cpu,
  Shield,
  LayoutDashboard,
  Zap,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const { Text } = Typography;

const NAV_GROUPS = (t) => [
  {
    key: 'site',
    label: t('站点与品牌'),
    icon: Globe,
    items: [
      { key: 'general', label: t('系统信息') },
      { key: 'notice', label: t('系统公告') },
      { key: 'topnav', label: t('顶部导航') },
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

export default function SettingsNav({ activeItem, onSelect }) {
  const { t } = useTranslation();
  const groups = NAV_GROUPS(t);

  // Default all groups open
  const [expanded, setExpanded] = useState(() => {
    const init = {};
    groups.forEach((g) => { init[g.key] = true; });
    return init;
  });

  function toggleGroup(key) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{
      width: '200px',
      minWidth: '200px',
      flexShrink: 0,
      borderRight: '1px solid var(--semi-color-border)',
      overflowY: 'auto',
      paddingBottom: '24px',
    }}>
      <div style={{ padding: '8px 0 4px 16px' }}>
        <Text type='tertiary' size='small' style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {t('系统管理')}
        </Text>
      </div>

      {groups.map((group) => {
        const Icon = group.icon;
        const isOpen = expanded[group.key];
        const isGroupActive = group.items.some((i) => i.key === activeItem);

        return (
          <div key={group.key}>
            {/* Group header */}
            <div
              onClick={() => toggleGroup(group.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px 8px 16px',
                cursor: 'pointer',
                userSelect: 'none',
                color: isGroupActive
                  ? 'var(--semi-color-primary)'
                  : 'var(--semi-color-text-1)',
                fontWeight: 500,
                fontSize: '13px',
                borderRadius: '6px',
                margin: '2px 8px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--semi-color-fill-0)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{group.label}</span>
              {isOpen
                ? <ChevronDown size={13} style={{ flexShrink: 0, color: 'var(--semi-color-text-2)' }} />
                : <ChevronRight size={13} style={{ flexShrink: 0, color: 'var(--semi-color-text-2)' }} />
              }
            </div>

            {/* Items */}
            {isOpen && (
              <div>
                {group.items.map((item) => {
                  const isActive = item.key === activeItem;
                  return (
                    <div
                      key={item.key}
                      onClick={() => onSelect(item.key)}
                      style={{
                        padding: '6px 12px 6px 40px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        borderRadius: '6px',
                        margin: '1px 8px',
                        color: isActive
                          ? 'var(--semi-color-primary)'
                          : 'var(--semi-color-text-1)',
                        background: isActive
                          ? 'var(--semi-color-primary-light-default)'
                          : 'transparent',
                        fontWeight: isActive ? 500 : 400,
                        transition: 'background 0.15s, color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'var(--semi-color-fill-0)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
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
  );
}
