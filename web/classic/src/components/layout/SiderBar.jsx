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

import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLucideIcon } from '../../helpers/render';
import { ChevronLeft } from 'lucide-react';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { useSidebar } from '../../hooks/common/useSidebar';
import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime';
import { isAdmin, isRoot } from '../../helpers';
import SkeletonWrapper from './components/SkeletonWrapper';

import { Nav, Divider, Button } from '@douyinfe/semi-ui';

const routerMap = {
  home: '/',
  channel: '/console/channel',
  token: '/console/token',
  redemption: '/console/redemption',
  topup: '/console/topup',
  user: '/console/user',
  user_group: '/console/user-groups',
  model_set: '/console/model-sets',
  model_grant: '/console/model-grants',
  subscription: '/console/subscription',
  log: '/console/log',
  midjourney: '/console/midjourney',
  setting: '/console/setting',
  about: '/about',
  detail: '/console',
  pricing: '/pricing',
  task: '/console/task',
  models: '/console/models',
  deployment: '/console/deployment',
  playground: '/console/playground',
  personal: '/console/personal',
};

const SiderBar = ({ onNavigate = () => {} }) => {
  const { t } = useTranslation();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const { isModuleVisible, sectionOrder, itemOrders, loading: sidebarLoading } =
    useSidebar();

  const showSkeleton = useMinimumLoadingTime(sidebarLoading, 200);

  const location = useLocation();
  const selectedKey = Object.keys(routerMap).find(
    (key) =>
      routerMap[key] ===
      location.pathname.replace(/\/model-grant$/, '/model-grants'),
  );
  const selectedKeys = selectedKey ? [selectedKey] : [];

  const rawSections = [
    {
      key: 'overview',
      title: t('Operations overview'),
      items: [
        {
          text: t('数据看板'),
          itemKey: 'detail',
          section: 'overview',
          enabled: localStorage.getItem('enable_data_export') === 'true',
        },
      ],
    },
    {
      key: 'resources',
      title: t('Model resources'),
      items: [
        { text: t('渠道管理'), itemKey: 'channel', section: 'resources' },
        { text: t('模型管理'), itemKey: 'models', section: 'resources' },
        { text: t('模型集管理'), itemKey: 'model_set', section: 'resources' },
        { text: t('模型部署'), itemKey: 'deployment', section: 'resources' },
        { text: t('操练场'), itemKey: 'playground', section: 'resources' },
      ],
    },
    {
      key: 'governance',
      title: t('Access governance'),
      items: [
        { text: t('授权管理'), itemKey: 'model_grant', section: 'governance' },
        { text: t('用户管理'), itemKey: 'user', section: 'governance' },
        { text: t('用户组管理'), itemKey: 'user_group', section: 'governance' },
        { text: t('API Key management'), itemKey: 'token', section: 'governance' },
      ],
    },
    {
      key: 'audit',
      title: t('Logs and audit'),
      items: [
        { text: t('Invocation logs'), itemKey: 'log', section: 'audit' },
        {
          text: t('绘图日志'),
          itemKey: 'midjourney',
          section: 'audit',
          enabled: localStorage.getItem('enable_drawing') === 'true',
        },
        {
          text: t('任务日志'),
          itemKey: 'task',
          section: 'audit',
          enabled: localStorage.getItem('enable_task') === 'true',
        },
      ],
    },
    {
      key: 'system',
      title: t('System configuration'),
      items: [
        {
          text: t('系统设置'),
          itemKey: 'setting',
          section: 'system',
          enabled: isRoot(),
        },
      ],
    },
  ];

  // Sort sections by sectionOrder
  const sortedSections = [...rawSections].sort((a, b) => {
    const aIdx = (sectionOrder || []).indexOf(a.key);
    const bIdx = (sectionOrder || []).indexOf(b.key);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  const sections = sortedSections
    .map((section) => {
      const order = (itemOrders && itemOrders[section.key]) || [];
      const sortedItems = [...section.items].sort((a, b) => {
        const aIdx = order.indexOf(a.itemKey);
        const bIdx = order.indexOf(b.itemKey);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
      return {
        ...section,
        items: sortedItems.filter(
          (item) =>
            isAdmin() &&
            item.enabled !== false &&
            isModuleVisible(item.section, item.itemKey),
        ),
      };
    })
    .filter((section) => section.items.length > 0);

  // 监控折叠状态变化以更新 body class
  useEffect(() => {
    if (collapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [collapsed]);

  // 选中高亮颜色（统一）
  const SELECTED_COLOR = 'var(--semi-color-primary)';

  // 渲染自定义菜单项
  const renderNavItem = (item) => {
    // 跳过隐藏的项目
    if (item.className === 'tableHiddle') return null;

    const isSelected = selectedKeys.includes(item.itemKey);
    const textColor = isSelected ? SELECTED_COLOR : 'inherit';

    return (
      <Nav.Item
        key={item.itemKey}
        itemKey={item.itemKey}
        text={
          <span
            className='truncate font-medium text-sm'
            style={{ color: textColor }}
          >
            {item.text}
          </span>
        }
        icon={
          <div className='sidebar-icon-container flex-shrink-0'>
            {getLucideIcon(item.itemKey, isSelected)}
          </div>
        }
        className={item.className}
      />
    );
  };

  return (
    <div
      className='sidebar-container'
      style={{
        width: 'var(--sidebar-current-width)',
      }}
    >
      <SkeletonWrapper
        loading={showSkeleton}
        type='sidebar'
        className=''
        collapsed={collapsed}
        showAdmin={isAdmin()}
      >
        <Nav
          className='sidebar-nav'
          defaultIsCollapsed={collapsed}
          isCollapsed={collapsed}
          onCollapseChange={toggleCollapsed}
          selectedKeys={selectedKeys}
          itemStyle='sidebar-nav-item'
          hoverStyle='sidebar-nav-item:hover'
          selectedStyle='sidebar-nav-item-selected'
          renderWrapper={({ itemElement, props }) => {
            const to = routerMap[props.itemKey];

            // 如果没有路由，直接返回元素
            if (!to) return itemElement;

            return (
              <Link
                style={{ textDecoration: 'none' }}
                to={to}
                aria-current={
                  selectedKeys.includes(props.itemKey) ? 'page' : undefined
                }
                onClick={onNavigate}
              >
                {itemElement}
              </Link>
            );
          }}
        >
          {sections.map((section, index) => (
            <div className='sidebar-section' key={section.title}>
              {index > 0 && <Divider className='sidebar-divider' />}
              {!collapsed && (
                <div className='sidebar-group-label'>{section.title}</div>
              )}
              {section.items.map(renderNavItem)}
            </div>
          ))}
        </Nav>
      </SkeletonWrapper>

      {/* 底部折叠按钮 */}
      <div className='sidebar-collapse-button'>
        <SkeletonWrapper
          loading={showSkeleton}
          type='button'
          width={collapsed ? 36 : 156}
          height={24}
          className='w-full'
        >
          <Button
            theme='outline'
            type='tertiary'
            size='small'
            icon={
              <ChevronLeft
                size={16}
                strokeWidth={2.5}
                color='var(--semi-color-text-2)'
                style={{
                  transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            }
            onClick={toggleCollapsed}
            icononly={collapsed}
            style={
              collapsed
                ? { width: 36, height: 24, padding: 0 }
                : { padding: '4px 12px', width: '100%' }
            }
          >
            {!collapsed ? t('收起侧边栏') : null}
          </Button>
        </SkeletonWrapper>
      </div>
    </div>
  );
};

export default SiderBar;
