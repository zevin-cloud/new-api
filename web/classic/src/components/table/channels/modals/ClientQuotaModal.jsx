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
  Collapse,
  Modal,
  Progress,
  Spin,
  Tag,
} from '@douyinfe/semi-ui';
import { clientAuth } from '../../../../services/clientAuth';

export function formatRemainingDuration(seconds) {
  const secs = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时 后刷新`;
  if (hours > 0) return `${hours} 小时 ${minutes} 分钟 后刷新`;
  return `${minutes} 分钟 后刷新`;
}

export default function ClientQuotaModal({ account, onClose }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchQuota = useCallback((isRefresh = false) => {
    if (!account?.id) return;
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
  }, [account?.id]);

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
          <span>{`${t('额度')} · ${account?.name || ''}`}</span>
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
