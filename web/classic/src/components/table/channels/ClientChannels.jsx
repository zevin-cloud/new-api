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

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Card,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Spin,
  Table,
  Tag,
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
  const [busyId, setBusyId] = useState(null);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      clientAuth.providers(controller.signal),
      clientAuth.accounts(page, controller.signal),
    ])
      .then(([available, list]) => {
        setProviders(available);
        setAccounts(list);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.response?.data?.message || err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
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
    try {
      await clientAuth.test(account);
      setTestResult(t('Connection successful'));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
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
        <Banner type='success' description={testResult} closeIcon={null} />
      )}
      {error && <Banner type='danger' description={error} closeIcon={null} />}
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
        setStatus('pending');
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
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
      await clientAuth.exchange(auth.session_id, callback.trim());
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
            <Select
              aria-label={t('Group')}
              value={group}
              onChange={setGroup}
              optionList={
                groupOptions.length
                  ? groupOptions
                  : [{ label: 'default', value: 'default' }]
              }
            />
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
