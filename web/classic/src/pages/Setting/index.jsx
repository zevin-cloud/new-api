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

import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spin } from '@douyinfe/semi-ui';
import { ArrowLeft } from 'lucide-react';
import { isRoot } from '../../helpers';
import SettingsNav from './SettingsNav';

// Lazy load all setting panels
const SystemSetting = lazy(() =>
  import('../../components/settings/SystemSetting'),
);
const OperationSetting = lazy(() =>
  import('../../components/settings/OperationSetting'),
);
const OtherSetting = lazy(() =>
  import('../../components/settings/OtherSetting'),
);
const RateLimitSetting = lazy(() =>
  import('../../components/settings/RateLimitSetting'),
);
const ModelSetting = lazy(() =>
  import('../../components/settings/ModelSetting'),
);
const DashboardSetting = lazy(() =>
  import('../../components/settings/DashboardSetting'),
);
const RatioSetting = lazy(() =>
  import('../../components/settings/RatioSetting'),
);
const ChatsSetting = lazy(() =>
  import('../../components/settings/ChatsSetting'),
);
const DrawingSetting = lazy(() =>
  import('../../components/settings/DrawingSetting'),
);
const PaymentSetting = lazy(() =>
  import('../../components/settings/PaymentSetting'),
);
const ModelDeploymentSetting = lazy(() =>
  import('../../components/settings/ModelDeploymentSetting'),
);
const PerformanceSetting = lazy(() =>
  import('../../components/settings/PerformanceSetting'),
);

const DEFAULT_ITEM = 'general';

function SettingsContent({ item }) {
  const loading = (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
      <Spin size='large' />
    </div>
  );

  const wrap = (node) => <Suspense fallback={loading}>{node}</Suspense>;

  switch (item) {
    // ── 站点与品牌 ──
    case 'general':
      return wrap(<SystemSetting section='general' />);
    case 'notice':
      // 系统公告在 OtherSetting 里
      return wrap(<OtherSetting initialSection='notice' />);
    case 'topnav':
      return wrap(<OperationSetting initialSection='topnav' />);
    case 'sidebar':
      return wrap(<OperationSetting initialSection='sidebar' />);

    // ── 身份验证 ──
    case 'login':
      return wrap(<SystemSetting section='login' />);
    case 'oauth':
      return wrap(<SystemSetting section='oauth' />);
    case 'passkey':
      return wrap(<SystemSetting section='passkey' />);
    case 'captcha':
      return wrap(<SystemSetting section='captcha' />);
    case 'custom-oauth':
      return wrap(<SystemSetting section='oauth' />);

    // ── 计费与支付 ──
    case 'payment':
      return wrap(<PaymentSetting />);

    // ── 模型与路由 ──
    case 'models':
      return wrap(<ModelSetting />);
    case 'model-deployment':
      return wrap(<ModelDeploymentSetting />);
    case 'ratio':
      return wrap(<RatioSetting />);
    case 'chats':
      return wrap(<ChatsSetting />);
    case 'drawing':
      return wrap(<DrawingSetting />);

    // ── 安全与限制 ──
    case 'ratelimit':
      return wrap(<RateLimitSetting />);
    case 'sensitive':
      return wrap(<OperationSetting initialSection='sensitive' />);
    case 'credit':
      return wrap(<OperationSetting initialSection='credit' />);

    // ── 控制台内容 ──
    case 'operation':
      return wrap(<OperationSetting initialSection='general_op' />);
    case 'dashboard':
      return wrap(<DashboardSetting />);
    case 'log':
      return wrap(<OperationSetting initialSection='log' />);
    case 'monitor':
      return wrap(<OperationSetting initialSection='monitor' />);
    case 'checkin':
      return wrap(<OperationSetting initialSection='checkin' />);

    // ── 性能与缓存 ──
    case 'performance':
      return wrap(<PerformanceSetting />);

    default:
      return wrap(<SystemSetting section='general' />);
  }
}

const Setting = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeItem, setActiveItem] = useState(DEFAULT_ITEM);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const item = searchParams.get('item');
    setActiveItem(item || DEFAULT_ITEM);
  }, [location.search]);

  function handleSelect(item) {
    setActiveItem(item);
    navigate(`?item=${item}`);
  }

  if (!isRoot()) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Back link bar */}
      <div
        style={{
          padding: '10px 20px',
          borderBottom: '1px solid var(--semi-color-border)',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          background: 'var(--semi-color-bg-0)',
        }}
      >
        <Link
          to='/console'
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--semi-color-text-1)',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={15} />
          {t('返回控制台')}
        </Link>
      </div>

      {/* Two-panel layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left nav */}
        <SettingsNav activeItem={activeItem} onSelect={handleSelect} />

        {/* Right content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 24px 40px 24px',
            minWidth: 0,
          }}
        >
          <SettingsContent item={activeItem} />
        </div>
      </div>
    </div>
  );
};

export default Setting;
