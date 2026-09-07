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

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Card,
  Collapse,
  Input,
  Modal,
  Pagination,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Toast,
} from '@douyinfe/semi-ui';
import { clientAuth } from '../../../services/clientAuth';

export default function ClientChannels({ groupOptions = [] }) {
  const { t } = useTranslation();
  const [providers, setProviders] = useState([]);
  const [accounts, setAccounts] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState(null);
  const [quotaAccount, setQuotaAccount] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      clientAuth.providers(controller.signal),
      clientAuth.accounts(page, controller.signal),
    ])
      .then(([available, list]) => {
        if (!active) return;
        setProviders(Array.isArray(available) ? available : []);
        setAccounts(
          list && Array.isArray(list.items) ? list : { items: [], total: 0 },
        );
      })
      .catch((err) => {
        if (!active) return;
        if (
          !controller.signal.aborted &&
          err?.name !== 'CanceledError' &&
          err?.message !== 'canceled' &&
          err?.code !== 'ERR_CANCELED'
        ) {
          setError(err.response?.data?.message || err.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, revision]);

  async function toggle(account) {
    setBusyId(account.id);
    setError('');
    try {
      await clientAuth.status(account.id, account.status === 1 ? 2 : 1);
      setRevision((value) => value + 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function testAccount(account) {
    setBusyId(account.id);
    setError('');
    setTestResult('');
    const startTime = Date.now();
    try {
      const res = await clientAuth.test(account);
      const seconds =
        typeof res?.time === 'number'
          ? res.time.toFixed(2)
          : ((Date.now() - startTime) / 1000).toFixed(2);
      const msg = `${t('Connection successful')} (${seconds}s)`;
      setTestResult(msg);
      Toast.success(msg);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      setError(errMsg);
      Toast.error(errMsg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className='space-y-5 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-lg font-semibold'>{t('Client accounts')}</h2>
          <p className='text-sm text-[var(--semi-color-text-2)]'>
            {t(
              'Authorize client accounts to provide APIs directly from New API.',
            )}
          </p>
        </div>
        <Button
          onClick={() => setRevision((value) => value + 1)}
          loading={loading}
        >
          {t('Refresh')}
        </Button>
      </div>
      {testResult && (
        <Banner
          type='success'
          description={testResult}
          closeIcon
          onClose={() => setTestResult('')}
        />
      )}
      {error && (
        <Banner
          type='danger'
          description={error}
          closeIcon
          onClose={() => setError('')}
        />
      )}
      <Spin spinning={loading}>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {providers.map((item) => (
            <Card key={item.slug} title={item.name}>
              <p className='mb-4 break-words text-xs text-[var(--semi-color-text-2)]'>
                {item.endpoint}
              </p>
              <Button theme='solid' onClick={() => setProvider(item)}>
                {t('Authorize account')}
              </Button>
            </Card>
          ))}
        </div>
        <div className='mt-5 overflow-x-auto'>
          <Table
            rowKey='id'
            dataSource={accounts.items}
            pagination={false}
            empty={t('No client accounts connected')}
            columns={[
              { title: t('Name'), dataIndex: 'name' },
              {
                title: t('Client'),
                dataIndex: 'provider',
                render: (value) =>
                  providers.find((item) => item.slug === value)?.name || value,
              },
              {
                title: t('Models'),
                dataIndex: 'models',
                render: (value) => <span className='break-all'>{value}</span>,
              },
              {
                title: t('Status'),
                dataIndex: 'status',
                render: (status) => (
                  <Tag color={status === 1 ? 'green' : 'grey'}>
                    {status === 1 ? t('Enabled') : t('Disabled')}
                  </Tag>
                ),
              },
              {
                title: t('Actions'),
                render: (_, account) => (
                  <Space>
                    <Button
                      disabled={busyId !== null || account.status !== 1}
                      onClick={() => testAccount(account)}
                    >
                      {t('Test')}
                    </Button>
                    <Button
                      disabled={busyId !== null}
                      onClick={() => setQuotaAccount(account)}
                    >
                      {t('额度')}
                    </Button>
                    <Button
                      loading={busyId === account.id}
                      disabled={busyId !== null && busyId !== account.id}
                      onClick={() => toggle(account)}
                    >
                      {account.status === 1 ? t('Disable') : t('Enable')}
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        </div>
        <Pagination
          className='mt-4'
          currentPage={page}
          pageSize={20}
          total={accounts.total}
          onPageChange={setPage}
        />
      </Spin>
      {provider && (
        <ClientAuthorization
          key={provider.slug}
          provider={provider}
          groupOptions={groupOptions}
          onClose={() => setProvider(null)}
          onCreated={() => {
            setProvider(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {quotaAccount && (
        <ClientQuotaModal
          account={quotaAccount}
          onClose={() => setQuotaAccount(null)}
        />
      )}
    </div>
  );
}

export function ClientAuthorization({
  provider,
  groupOptions,
  onClose,
  onCreated,
}) {
  const { t } = useTranslation();
  const [auth, setAuth] = useState(null);
  const [status, setStatus] = useState('starting');
  const [error, setError] = useState('');
  const [callback, setCallback] = useState('');
  const [name, setName] = useState(provider.name);
  const [models, setModels] = useState('');
  const [group, setGroup] = useState('default');
  const [saving, setSaving] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    clientAuth
      .start(provider.slug, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setAuth({ ...data, deadline: Date.now() + data.expires_in * 1000 });
        if (data.default_models && data.default_models.length > 0) {
          setModels(data.default_models.join(', '));
        }
        setStatus('pending');
      })
      .catch((err) => {
        if (
          !controller.signal.aborted &&
          err?.name !== 'CanceledError' &&
          err?.message !== 'canceled' &&
          err?.code !== 'ERR_CANCELED'
        ) {
          setError(err.response?.data?.message || err.message);
          setStatus('failed');
        }
      });
    return () => controller.abort();
  }, [provider.slug]);

  useEffect(() => {
    if (!auth || status !== 'pending') return;
    const controller = new AbortController();
    let timer;
    async function poll() {
      if (Date.now() >= auth.deadline) {
        setStatus('expired');
        return;
      }
      try {
        if (auth.auth_type === 'device_code') {
          const progress = await clientAuth.poll(
            auth.session_id,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          if (progress.status !== 'pending') {
            setStatus(progress.status);
            if (progress.default_name) {
              setName(progress.default_name);
            }
            if (progress.default_models && progress.default_models.length > 0) {
              setModels(progress.default_models.join(', '));
            }
            if (progress.error_msg) setError(progress.error_msg);
            return;
          }
        }
        timer = setTimeout(poll, Math.max(auth.interval || 5, 1) * 1000);
      } catch (err) {
        if (!controller.signal.aborted) {
          setStatus('failed');
          setError(err.response?.data?.message || err.message);
        }
      }
    }
    timer = setTimeout(poll, Math.max(auth.interval || 5, 1) * 1000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [auth, status]);

  async function exchange() {
    setExchanging(true);
    setError('');
    try {
      const res = await clientAuth.exchange(auth.session_id, callback.trim());
      if (res?.default_name) {
        setName(res.default_name);
      }
      if (res?.default_models && res.default_models.length > 0) {
        setModels(res.default_models.join(', '));
      }
      setStatus('success');
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setExchanging(false);
    }
  }

  async function create() {
    setSaving(true);
    setError('');
    try {
      await clientAuth.create({
        session_id: auth.session_id,
        channel_name: name.trim(),
        group,
        models: models
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  }

  const authURL = auth?.verification_url || auth?.auth_url;
  return (
    <Modal
      visible
      title={`${t('Authorize account')} · ${provider.name}`}
      onCancel={onClose}
      footer={null}
      width={600}
      closeOnEsc={!saving && !exchanging}
      maskClosable={false}
    >
      <div className='space-y-4'>
        {error && <Banner type='danger' description={error} closeIcon={null} />}
        {status === 'starting' && <Spin tip={t('Starting authorization')} />}
        {status === 'expired' && (
          <Banner
            type='warning'
            description={t(
              'Authorization expired. Close this dialog and try again.',
            )}
            closeIcon={null}
          />
        )}
        {status === 'pending' && auth && (
          <>
            <p>
              {t('Open the authorization page and sign in to your account.')}
            </p>
            {auth.user_code && (
              <div className='rounded-lg bg-[var(--semi-color-fill-0)] p-4 text-center font-mono text-2xl tracking-widest'>
                {auth.user_code}
              </div>
            )}
            {authURL?.startsWith('https://') && (
              <a
                href={authURL}
                target='_blank'
                rel='noopener noreferrer'
                className='text-[var(--semi-color-primary)] underline'
              >
                {t('Open authorization page')}
              </a>
            )}
            {auth.auth_type === 'oauth_pkce' && (
              <>
                <p className='text-sm'>
                  {t(
                    'After signing in, copy the complete callback URL from the address bar, even if the local page cannot open.',
                  )}
                </p>
                <Input
                  aria-label={t('Callback URL')}
                  value={callback}
                  onChange={setCallback}
                  placeholder={t('Callback URL')}
                />
                <Button
                  onClick={exchange}
                  loading={exchanging}
                  disabled={!callback.trim()}
                >
                  {t('Complete authorization')}
                </Button>
              </>
            )}
          </>
        )}
        {status === 'success' && (
          <>
            <Banner
              type='success'
              description={t(
                'Account authorized. Choose the channel name and available models.',
              )}
              closeIcon={null}
            />
            <label className='block'>
              {t('Channel name')}
              <Input
                aria-label={t('Channel name')}
                value={name}
                onChange={setName}
                maxLength={100}
              />
            </label>
            <label className='block'>
              {t('Models')}
              <Input
                aria-label={t('Models')}
                value={models}
                onChange={setModels}
                placeholder={t('Enter model IDs separated by commas')}
              />
            </label>
            <p className='text-xs text-[var(--semi-color-text-2)]'>
              {t(
                'Use model IDs available to this account. API access still requires a New API token.',
              )}
            </p>
            <Button
              theme='solid'
              onClick={create}
              loading={saving}
              disabled={!name.trim() || !models.trim()}
            >
              {t('Create client channel')}
            </Button>
          </>
        )}
        <Space>
          <Button onClick={onClose} disabled={saving || exchanging}>
            {t('Close')}
          </Button>
        </Space>
      </div>
    </Modal>
  );
}

function formatRemainingDuration(seconds) {
  const secs = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时 后刷新`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟 后刷新`;
  return `${minutes} 分钟 后刷新`;
}

export function ClientQuotaModal({ account, onClose }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuota = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    const controller = new AbortController();
    clientAuth
      .quota(account.id, controller.signal)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        if (
          !controller.signal.aborted &&
          err?.name !== 'CanceledError' &&
          err?.message !== 'canceled' &&
          err?.code !== 'ERR_CANCELED'
        ) {
          setError(err.response?.data?.message || err.message);
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
    return () => controller.abort();
  }, [account.id]);

  useEffect(() => {
    return fetchQuota(false);
  }, [fetchQuota]);

  const groups = data?.data?.groups || [];
  const rawData = data?.data;

  const plan = data?.data?.plan || '';
  let planLabel = '';
  let planColor = 'blue';
  if (plan === 'pro') {
    planLabel = '套餐 Pro';
    planColor = 'violet';
  } else if (plan === 'ultra') {
    planLabel = '套餐 Ultra';
    planColor = 'green';
  } else if (plan === 'free') {
    planLabel = '套餐 Free';
    planColor = 'amber';
  } else if (plan) {
    planLabel = `套餐 ${plan.toUpperCase()}`;
  }

  return (
    <Modal
      visible
      title={
        <div className='flex items-center justify-between pr-8'>
          <span>{`${t('额度')} · ${account.name}`}</span>
          <Button
            size='small'
            theme='borderless'
            loading={refreshing}
            onClick={() => fetchQuota(true)}
          >
            {t('Refresh')}
          </Button>
        </div>
      }
      onCancel={onClose}
      footer={
        <Button onClick={onClose}>{t('Close')}</Button>
      }
      width={720}
    >
      <div className='space-y-4'>
        {error && <Banner type='danger' description={error} closeIcon={null} />}
        {loading ? (
          <div className='py-8 text-center'>
            <Spin size='large' />
          </div>
        ) : (
          <>
            {(data?.email || planLabel) && (
              <div className='flex items-center justify-between text-sm bg-[var(--semi-color-fill-0)] p-3 rounded-lg'>
                <div className='flex items-center gap-3'>
                  {data?.email && (
                    <div>
                      <span className='text-[var(--semi-color-text-2)]'>{t('邮箱')}: </span>
                      <span className='font-mono font-medium'>{data.email}</span>
                    </div>
                  )}
                  {planLabel && (
                    <Tag color={planColor} size='small'>
                      {planLabel}
                    </Tag>
                  )}
                </div>
                {data.provider && (
                  <Tag color='blue'>{data.provider.toUpperCase()}</Tag>
                )}
              </div>
            )}

            {groups.length > 0 ? (
              <div className='space-y-4 max-h-[60vh] overflow-y-auto pr-1'>
                {groups.map((group, idx) => {
                  const cleanDesc = (group.description || '').replace(/^Models within this group:\s*/i, '');
                  return (
                    <div
                      key={group.id || idx}
                      className='rounded-lg border border-[var(--semi-color-border)] p-4 bg-[var(--semi-color-bg-0)]'
                    >
                      <div className='flex items-center justify-between mb-3'>
                        <div className='font-semibold text-base'>
                          {group.label || group.displayName || `Quota Group ${idx + 1}`}
                        </div>
                        {cleanDesc && (
                          <span className='text-xs text-[var(--semi-color-text-2)]'>
                            {cleanDesc.startsWith('此分组包含')
                              ? cleanDesc
                              : `此分组包含: ${cleanDesc}`}
                          </span>
                        )}
                      </div>
                      <div className='space-y-3.5'>
                        {(group.buckets || []).map((bucket, bIdx) => {
                          const fraction = bucket.remainingFraction ?? bucket.remaining_fraction ?? 0;
                          const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
                          const isAvailable = pct >= 100 || fraction >= 0.999;
                          const isLow = pct < 20;
                          const isWarn = pct < 50;
                          const stroke = isAvailable
                            ? '#10b981'
                            : isLow
                            ? '#ef4444'
                            : '#f59e0b';

                          let resetText = '';
                          const rTime = bucket.resetTime || bucket.reset_time;
                          if (rTime) {
                            const resetMs = new Date(rTime).getTime();
                            if (!Number.isNaN(resetMs)) {
                              const deltaSecs = Math.floor((resetMs - Date.now()) / 1000);
                              if (deltaSecs > 0) {
                                resetText = formatRemainingDuration(deltaSecs);
                              } else {
                                resetText = t('已刷新');
                              }
                            }
                          }

                          return (
                            <div key={bucket.id || bIdx} className='space-y-1.5'>
                              <div className='flex items-center justify-between text-sm'>
                                <div className='flex items-center gap-2'>
                                  <span className='font-medium'>
                                    {bucket.label || bucket.displayName || bucket.bucketId || `Bucket ${bIdx + 1}`}
                                  </span>
                                  {bucket.window && (
                                    <Tag size='small' color='grey'>
                                      {bucket.window}
                                    </Tag>
                                  )}
                                </div>
                                <div className='flex items-center gap-3'>
                                  {isAvailable ? (
                                    <Tag color='green'>{t('额度可用')}</Tag>
                                  ) : (
                                    <Tag color={isLow ? 'red' : isWarn ? 'orange' : 'green'}>
                                      {pct}% {t('剩余')}
                                    </Tag>
                                  )}
                                  {resetText && (
                                    <span className='text-xs text-[var(--semi-color-text-2)]'>
                                      {resetText}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Progress
                                percent={pct}
                                stroke={stroke}
                                showInfo={false}
                                style={{ height: 8 }}
                              />
                              {rTime && (
                                <div className='text-xs text-[var(--semi-color-text-2)] text-right'>
                                  {new Date(rTime).toLocaleString()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : rawData ? (
              <div className='rounded-lg border border-[var(--semi-color-border)] p-4 bg-[var(--semi-color-bg-0)]'>
                <pre className='max-h-96 overflow-auto text-xs font-mono whitespace-pre-wrap'>
                  {JSON.stringify(rawData, null, 2)}
                </pre>
              </div>
            ) : (
              <p className='text-sm text-[var(--semi-color-text-2)] py-4 text-center'>
                {t('暂无可用配额数据')}
              </p>
            )}

            {groups.length > 0 && (
              <Collapse>
                <Collapse.Panel header={t('原始 JSON')} itemKey='raw'>
                  <pre className='max-h-60 overflow-auto text-xs font-mono whitespace-pre-wrap bg-[var(--semi-color-fill-0)] p-2 rounded'>
                    {JSON.stringify(rawData, null, 2)}
                  </pre>
                </Collapse.Panel>
              </Collapse>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

