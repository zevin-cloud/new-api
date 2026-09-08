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

import React, { useCallback, useEffect, useRef, useState } from 'react';
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

export function formatWindowDuration(seconds) {
  const secs = Math.max(0, Math.floor(Number(seconds) || 0));
  if (secs >= 86400) {
    const days = Math.round(secs / 86400);
    return `${days} 天`;
  }
  if (secs >= 3600) {
    const hours = Math.round(secs / 3600);
    return `${hours} 小时`;
  }
  const mins = Math.round(secs / 60);
  return `${mins} 分钟`;
}

export default function ClientQuotaModal({ account, onClose }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const mountedRef = useRef(true);

  const fetchQuota = useCallback(async (isRefresh = false) => {
    if (!account?.id) {
      setLoading(false);
      return;
    }
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await clientAuth.quota(account.id);
      if (!mountedRef.current) return;
      setData(res);
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err?.response?.data?.message || err?.message || t('获取配额失败');
      setError(msg);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [account?.id, t]);

  useEffect(() => {
    mountedRef.current = true;
    fetchQuota(false);
    return () => {
      mountedRef.current = false;
    };
  }, [fetchQuota]);

  const rawData = data?.data;
  const groups = rawData?.groups || [];
  const rateLimit = rawData?.rate_limit;
  const modelUsage = rawData?.model_usage;
  const credits = rawData?.credits;
  const resetCredits = rawData?.rate_limit_reset_credits;

  const email = data?.email || rawData?.email || '';
  const provider = (data?.provider || (rateLimit || modelUsage ? 'codex' : '')).toLowerCase();
  const planType = (rawData?.plan_type || rawData?.plan || '').toLowerCase();

  let planLabel = '';
  let planColor = 'blue';
  if (planType === 'plus') {
    planLabel = 'ChatGPT Plus';
    planColor = 'green';
  } else if (planType === 'pro') {
    planLabel = provider === 'codex' ? 'ChatGPT Pro' : '套餐 Pro';
    planColor = 'violet';
  } else if (planType === 'team') {
    planLabel = 'ChatGPT Team';
    planColor = 'blue';
  } else if (planType === 'ultra') {
    planLabel = '套餐 Ultra';
    planColor = 'green';
  } else if (planType === 'free') {
    planLabel = provider === 'codex' ? 'ChatGPT Free' : '套餐 Free';
    planColor = 'amber';
  } else if (planType) {
    planLabel = `套餐 ${planType.toUpperCase()}`;
  }

  const renderCodexWindow = (title, windowData) => {
    if (!windowData) return null;
    const usedPct = Math.max(0, Math.min(100, Math.round(Number(windowData.used_percent) || 0)));
    const remainingPct = Math.max(0, 100 - usedPct);
    const stroke = remainingPct >= 50 ? '#10b981' : remainingPct >= 20 ? '#f59e0b' : '#ef4444';

    let resetText = '';
    if (windowData.reset_after_seconds) {
      resetText = formatRemainingDuration(windowData.reset_after_seconds);
    } else if (windowData.reset_at) {
      const delta = Math.floor(windowData.reset_at - Date.now() / 1000);
      if (delta > 0) resetText = formatRemainingDuration(delta);
    }

    const windowDuration = windowData.limit_window_seconds
      ? formatWindowDuration(windowData.limit_window_seconds)
      : '';

    return (
      <div className='space-y-2 p-3 rounded-lg border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-1)]'>
        <div className='flex items-center justify-between text-sm'>
          <div className='flex items-center gap-2'>
            <span className='font-medium'>{title}</span>
            {windowDuration && (
              <Tag size='small' color='grey'>
                {windowDuration} {t('周期')}
              </Tag>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <Tag color={stroke === '#10b981' ? 'green' : stroke === '#f59e0b' ? 'orange' : 'red'}>
              {t('剩余')} {remainingPct}%
            </Tag>
            {resetText && (
              <span className='text-xs text-[var(--semi-color-text-2)]'>
                {resetText}
              </span>
            )}
          </div>
        </div>
        <Progress
          percent={remainingPct}
          stroke={stroke}
          showInfo={false}
          style={{ height: 8 }}
        />
        <div className='flex items-center justify-between text-xs text-[var(--semi-color-text-2)]'>
          <span>{t('已用')}: {usedPct}%</span>
          {windowData.reset_at && (
            <span>
              {t('重置时间')}: {new Date(windowData.reset_at * 1000).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    );
  };

  const isCodexData = Boolean(rateLimit || modelUsage || credits || provider === 'codex');

  return (
    <Modal
      visible
      title={
        <div className='flex items-center justify-between pr-8'>
          <span>{`${t('额度')} · ${account?.name || ''}`}</span>
          <Button
            size='small'
            theme='borderless'
            loading={loading || refreshing}
            onClick={() => fetchQuota(true)}
          >
            {t('刷新')}
          </Button>
        </div>
      }
      onCancel={onClose}
      footer={
        <Button onClick={onClose}>{t('Close')}</Button>
      }
      width={720}
    >
      <div className='min-h-[180px]'>
        {loading && !data ? (
          <div className='py-16 flex flex-col items-center justify-center gap-3'>
            <Spin size='large' spinning={true} />
            <span className='text-sm text-[var(--semi-color-text-2)]'>
              {t('正在加载配额数据...')}
            </span>
          </div>
        ) : error && !data ? (
          <div className='py-8 space-y-4 text-center'>
            <Banner type='danger' description={error} closeIcon={null} />
            <Button
              type='primary'
              theme='outline'
              onClick={() => fetchQuota(true)}
            >
              {t('重试')}
            </Button>
          </div>
        ) : (
          <Spin
            spinning={refreshing}
            tip={t('正在刷新配额数据...')}
          >
            <div className='space-y-4'>
              {error && <Banner type='danger' description={error} closeIcon={null} />}

              {(email || planLabel || provider) && (
                <div className='flex flex-wrap items-center justify-between gap-2 text-sm bg-[var(--semi-color-fill-0)] p-3 rounded-lg'>
                  <div className='flex flex-wrap items-center gap-3'>
                    {email && (
                      <div>
                        <span className='text-[var(--semi-color-text-2)]'>{t('邮箱')}: </span>
                        <span className='font-mono font-medium'>{email}</span>
                      </div>
                    )}
                    {planLabel && (
                      <Tag color={planColor} size='small'>
                        {planLabel}
                      </Tag>
                    )}
                    {resetCredits?.available_count !== undefined && resetCredits.available_count > 0 && (
                      <Tag color='cyan' size='small'>
                        {t('重置额度')}: {resetCredits.available_count} {t('次')}
                      </Tag>
                    )}
                  </div>
                  {provider && (
                    <Tag color='blue'>{provider.toUpperCase()}</Tag>
                  )}
                </div>
              )}

              {/* Antigravity Group Quotas */}
              {groups.length > 0 && (
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
              )}

              {/* Codex / ChatGPT Subscription Formatted Quotas */}
              {isCodexData && (
                <div className='space-y-4 max-h-[60vh] overflow-y-auto pr-1'>
                  {/* Rate Limits */}
                  {rateLimit && (
                    <div className='rounded-lg border border-[var(--semi-color-border)] p-4 bg-[var(--semi-color-bg-0)] space-y-3'>
                      <div className='flex items-center justify-between'>
                        <div className='font-semibold text-sm'>{t('速率限额窗口')}</div>
                        <Tag color={rateLimit.allowed !== false && !rateLimit.limit_reached ? 'green' : 'red'} size='small'>
                          {rateLimit.allowed !== false && !rateLimit.limit_reached ? t('状态正常') : t('已达速率上限')}
                        </Tag>
                      </div>
                      <div className='space-y-2.5'>
                        {renderCodexWindow(t('主速率限制 (短期)'), rateLimit.primary_window)}
                        {renderCodexWindow(t('周速率限制 (长期)'), rateLimit.secondary_window)}
                      </div>
                    </div>
                  )}

                  {/* Model Usage */}
                  {modelUsage && typeof modelUsage === 'object' && Object.keys(modelUsage).length > 0 && (
                    <div className='rounded-lg border border-[var(--semi-color-border)] p-4 bg-[var(--semi-color-bg-0)]'>
                      <div className='font-semibold text-sm mb-3 flex items-center justify-between'>
                        <span>{t('模型可用状态')}</span>
                        <span className='text-xs text-[var(--semi-color-text-2)] font-normal'>
                          {Object.keys(modelUsage).length} {t('个模型')}
                        </span>
                      </div>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2.5'>
                        {Object.entries(modelUsage).map(([modelName, usage]) => {
                          const isAvailable = usage?.available !== false;
                          return (
                            <div
                              key={modelName}
                              className='flex items-center justify-between p-2.5 rounded border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-1)]'
                            >
                              <div className='flex flex-col'>
                                <span className='font-mono font-medium text-xs'>{modelName}</span>
                                {usage?.available_at && (
                                  <span className='text-[10px] text-[var(--semi-color-text-2)]'>
                                    {new Date(usage.available_at).toLocaleString()} {t('恢复可用')}
                                  </span>
                                )}
                              </div>
                              <Tag color={isAvailable ? 'green' : 'red'} size='small'>
                                {isAvailable ? t('可用') : t('受限')}
                              </Tag>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Credits & Account Info */}
                  {(credits || rawData?.account_id) && (
                    <div className='rounded-lg border border-[var(--semi-color-border)] p-4 bg-[var(--semi-color-bg-0)]'>
                      <div className='font-semibold text-sm mb-3'>{t('点数与账户详情')}</div>
                      <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs'>
                        {credits?.balance !== undefined && (
                          <div className='p-2.5 rounded bg-[var(--semi-color-fill-0)]'>
                            <div className='text-[var(--semi-color-text-2)] mb-1'>{t('点数余额')}</div>
                            <div className='font-semibold text-sm'>{credits.balance}</div>
                          </div>
                        )}
                        {credits?.unlimited !== undefined && (
                          <div className='p-2.5 rounded bg-[var(--semi-color-fill-0)]'>
                            <div className='text-[var(--semi-color-text-2)] mb-1'>{t('额度属性')}</div>
                            <div className='font-semibold text-sm'>
                              {credits.unlimited ? t('无限制') : t('常规额度')}
                            </div>
                          </div>
                        )}
                        {resetCredits?.available_count !== undefined && (
                          <div className='p-2.5 rounded bg-[var(--semi-color-fill-0)]'>
                            <div className='text-[var(--semi-color-text-2)] mb-1'>{t('限流重置机会')}</div>
                            <div className='font-semibold text-sm'>
                              {resetCredits.available_count} {t('次')}
                            </div>
                          </div>
                        )}
                        {rawData?.account_id && (
                          <div className='p-2.5 rounded bg-[var(--semi-color-fill-0)] col-span-2 sm:col-span-3'>
                            <div className='text-[var(--semi-color-text-2)] mb-1'>{t('账户 ID')}</div>
                            <div className='font-mono text-xs break-all'>{rawData.account_id}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Empty / Unrecognized data fallback */}
              {groups.length === 0 && !isCodexData && (
                rawData ? (
                  <div className='rounded-lg border border-[var(--semi-color-border)] p-4 bg-[var(--semi-color-bg-0)]'>
                    <pre className='max-h-96 overflow-auto text-xs font-mono whitespace-pre-wrap'>
                      {JSON.stringify(rawData, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <p className='text-sm text-[var(--semi-color-text-2)] py-4 text-center'>
                    {t('暂无可用配额数据')}
                  </p>
                )
              )}

              {/* Raw JSON collapsible inspector */}
              {rawData && (
                <Collapse>
                  <Collapse.Panel header={t('原始 JSON')} itemKey='raw'>
                    <pre className='max-h-60 overflow-auto text-xs font-mono whitespace-pre-wrap bg-[var(--semi-color-fill-0)] p-2 rounded'>
                      {JSON.stringify(rawData, null, 2)}
                    </pre>
                  </Collapse.Panel>
                </Collapse>
              )}
            </div>
          </Spin>
        )}
      </div>
    </Modal>
  );
}
