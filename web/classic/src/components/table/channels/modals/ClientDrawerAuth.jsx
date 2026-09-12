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

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Card,
  Input,
  RadioGroup,
  Radio,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconCopy,
  IconExternalOpen,
  IconRefresh,
} from '@douyinfe/semi-icons';
import { Check, Cloud } from 'lucide-react';
import { copy } from '../../../../helpers/utils';
import { clientAuth } from '../../../../services/clientAuth';
import { OpenAI, Claude, Moonshot, Gemini } from '@lobehub/icons';

const { Text } = Typography;

const DEFAULT_PROVIDERS = [
  { slug: 'antigravity', name: 'Antigravity', icon: <Gemini.Color size={16} /> },
  { slug: 'claude', name: 'Claude Code', icon: <Claude.Color size={16} /> },
  { slug: 'codex', name: 'ChatGPT / Codex', icon: <OpenAI size={16} /> },
  { slug: 'kimi', name: 'Kimi Code', icon: <Moonshot size={16} /> },
  { slug: 'kiro', name: 'Kiro', icon: <Cloud size={16} /> },
];

export default function ClientDrawerAuth({
  onAuthSuccess,
  isEdit = false,
  channel = null,
}) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
  const [selectedProvider, setSelectedProvider] = useState('antigravity');
  const [auth, setAuth] = useState(null);
  const [status, setStatus] = useState(isEdit ? 'idle' : 'idle');
  const [error, setError] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [exchanging, setExchanging] = useState(false);
  const [authResult, setAuthResult] = useState(null);
  const [expanded, setExpanded] = useState(!isEdit);
  const activeSessionRef = useRef(null);

  useEffect(() => {
    let active = true;
    clientAuth
      .providers()
      .then((res) => {
        if (!active || !Array.isArray(res) || res.length === 0) return;
        setProviders(
          res.map((p) => {
            let icon = null;
            if (p.slug === 'antigravity') icon = <Gemini.Color size={16} />;
            else if (p.slug === 'claude') icon = <Claude.Color size={16} />;
            else if (p.slug === 'codex') icon = <OpenAI size={16} />;
            else if (p.slug === 'kimi') icon = <Moonshot size={16} />;
            else if (p.slug === 'kiro') icon = <Cloud size={16} />;
            return { ...p, icon };
          }),
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const startAuth = async (slug) => {
    const providerSlug = slug || selectedProvider;
    setStatus('starting');
    setError('');
    setCallbackUrl('');
    setAuth(null);
    setAuthResult(null);

    const controller = new AbortController();
    try {
      const data = await clientAuth.start(providerSlug, controller.signal);
      const authSession = {
        ...data,
        deadline: Date.now() + (data.expires_in || 600) * 1000,
      };
      setAuth(authSession);
      activeSessionRef.current = authSession.session_id;
      setStatus('pending');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setStatus('failed');
    }
  };

  // Device Code polling
  useEffect(() => {
    if (!auth || status !== 'pending' || auth.auth_type !== 'device_code') return;
    const controller = new AbortController();
    let timer;

    async function poll() {
      if (Date.now() >= auth.deadline) {
        setStatus('expired');
        return;
      }
      try {
        const progress = await clientAuth.poll(
          auth.session_id,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (progress.status === 'success') {
          setStatus('success');
          setAuthResult(progress);
          if (onAuthSuccess) {
            onAuthSuccess(progress);
          }
          return;
        } else if (progress.status === 'failed') {
          setStatus('failed');
          setError(progress.error_msg || t('授权失败'));
          return;
        } else if (progress.status === 'expired') {
          setStatus('expired');
          return;
        }
        timer = setTimeout(poll, Math.max(auth.interval || 5, 2) * 1000);
      } catch (err) {
        if (!controller.signal.aborted) {
          timer = setTimeout(poll, Math.max(auth.interval || 5, 2) * 1000);
        }
      }
    }

    timer = setTimeout(poll, Math.max(auth.interval || 5, 2) * 1000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [auth, status, onAuthSuccess, t]);

  const handleExchange = async () => {
    if (!auth?.session_id || !callbackUrl.trim()) return;
    setExchanging(true);
    setError('');
    try {
      const res = await clientAuth.exchange(
        auth.session_id,
        callbackUrl.trim(),
      );
      setStatus('success');
      setAuthResult(res);
      if (onAuthSuccess) {
        onAuthSuccess(res);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setExchanging(false);
    }
  };

  const handleProviderSelect = (slug) => {
    setSelectedProvider(slug);
    if (status !== 'idle' && status !== 'success') {
      startAuth(slug);
    }
  };

  const authURL = auth?.verification_url || auth?.auth_url;

  return (
    <Card
      className='mb-4 border border-[var(--semi-color-primary-light-default)] bg-[var(--semi-color-primary-light-light)] dark:bg-[var(--semi-color-bg-1)]'
      bodyStyle={{ padding: '16px' }}
    >
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <span className='font-semibold text-sm'>
            {t('客户端授权 (OAuth / Device Code)')}
          </span>
          {status === 'success' && (
            <Tag color='green' prefixIcon={<Check size={12} />}>
              {t('已授权')}
            </Tag>
          )}
        </div>
        {isEdit && (
          <Button
            size='small'
            theme='borderless'
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? t('收起') : t('重新授权账号')}
          </Button>
        )}
      </div>

      {expanded && (
        <div className='space-y-3.5'>
          {/* Provider Selection */}
          <div>
            <Text type='secondary' className='text-xs block mb-2'>
              {t('选择客户端厂商')}
            </Text>
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5'>
              {providers.map((p) => {
                const isSelected = selectedProvider === p.slug;
                return (
                  <button
                    key={p.slug}
                    type='button'
                    onClick={() => handleProviderSelect(p.slug)}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-[var(--semi-color-primary)] bg-[var(--semi-color-primary-light-default)] text-[var(--semi-color-primary)] shadow-sm'
                        : 'border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] hover:border-[var(--semi-color-primary)] text-[var(--semi-color-text-0)]'
                    }`}
                  >
                    {p.icon}
                    <span>{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <Banner
              type='danger'
              description={error}
              closeIcon
              onClose={() => setError('')}
            />
          )}

          {/* Idle state */}
          {status === 'idle' && (
            <div className='pt-1'>
              <Button
                theme='solid'
                type='primary'
                onClick={() => startAuth()}
              >
                {t('开始授权此客户端账号')}
              </Button>
            </div>
          )}

          {/* Starting state */}
          {status === 'starting' && (
            <div
              className='flex min-h-12 items-center justify-center gap-2 py-3'
              role='status'
              aria-live='polite'
            >
              <Spin size='small' />
              <span className='whitespace-nowrap text-sm text-[var(--semi-color-text-1)]'>
                {t('正在初始化客户端授权...')}
              </span>
            </div>
          )}

          {/* Expired state */}
          {status === 'expired' && (
            <Banner
              type='warning'
              description={t('授权已过期，请重新发起授权。')}
              action={
                <Button size='small' onClick={() => startAuth()}>
                  {t('重新发起')}
                </Button>
              }
            />
          )}

          {/* Pending state */}
          {status === 'pending' && auth && (
            <div className='space-y-3 rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-0)] p-3.5'>
              {auth.auth_type === 'device_code' ? (
                <>
                  <p className='text-xs text-[var(--semi-color-text-1)]'>
                    {t('请在浏览器中打开授权页面，核对或输入下方授权码完成登录：')}
                  </p>
                  {auth.user_code && (
                    <div className='flex items-center justify-center gap-3 p-2.5 rounded-lg bg-[var(--semi-color-fill-0)] font-mono text-xl font-bold tracking-widest text-[var(--semi-color-primary)]'>
                      <span>{auth.user_code}</span>
                      <Button
                        size='small'
                        theme='borderless'
                        icon={<IconCopy />}
                        onClick={() => copy(auth.user_code)}
                      >
                        {t('复制')}
                      </Button>
                    </div>
                  )}
                  <div className='flex items-center justify-between gap-2 pt-1'>
                    {authURL && (
                      <Button
                        theme='solid'
                        type='primary'
                        icon={<IconExternalOpen />}
                        onClick={() => window.open(authURL, '_blank')}
                      >
                        {t('打开授权页面')}
                      </Button>
                    )}
                    <div className='flex items-center gap-2 text-xs text-[var(--semi-color-text-2)]'>
                      <Spin size='small' />
                      <span>{t('等待浏览器授权...')}</span>
                    </div>
                  </div>
                </>
              ) : auth.auth_type === 'oauth_pkce' ? (
                <>
                  <p className='text-xs text-[var(--semi-color-text-1)]'>
                    {t(
                      '1. 点击下方按钮在浏览器中完成登录并授权；2. 授权完成后，从浏览器地址栏复制完整的跳转 URL（包含 code 和 state）粘贴至下方：',
                    )}
                  </p>
                  {authURL && (
                    <div>
                      <Button
                        theme='solid'
                        type='primary'
                        icon={<IconExternalOpen />}
                        onClick={() => window.open(authURL, '_blank')}
                      >
                        {t('打开授权页面')}
                      </Button>
                    </div>
                  )}
                  <div className='space-y-2 pt-1'>
                    <Input
                      placeholder={t('粘贴地址栏完整重定向 URL (例如: http://localhost:8085/oauth2callback?code=...)')}
                      value={callbackUrl}
                      onChange={setCallbackUrl}
                    />
                    <Button
                      theme='solid'
                      onClick={handleExchange}
                      loading={exchanging}
                      disabled={!callbackUrl.trim()}
                    >
                      {t('完成授权并填入配置')}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Success state */}
          {status === 'success' && (
            <div className='space-y-2.5'>
              <Banner
                type='success'
                description={
                  <div className='text-xs space-y-1'>
                    <div className='font-semibold'>
                      {t('客户端授权成功！已自动填充渠道名称、密钥凭据与可用模型。')}
                    </div>
                    {authResult?.email && (
                      <div>
                        {t('授权账号')}: <span className='font-mono'>{authResult.email}</span>
                      </div>
                    )}
                  </div>
                }
                closeIcon={null}
              />
              <Button
                size='small'
                theme='borderless'
                icon={<IconRefresh />}
                onClick={() => startAuth()}
              >
                {t('重新授权或切换账号')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
