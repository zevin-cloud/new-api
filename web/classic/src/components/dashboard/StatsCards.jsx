/*
Copyright (C) 2025-2026 QuantumNous

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

import React from 'react';
import { Card, Skeleton, Tooltip } from '@douyinfe/semi-ui';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Coins,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  ShieldCheck,
  Zap,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

export default function StatsCards({
  stats = {},
  loading = false,
  isAdminUser = true,
  onUserCardClick,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const {
    totalTokens = 0,
    totalTokensFormatted = '0',
    totalTokensExact = '0',
    validRequests = 0,
    successRate = '100.00%',
    failedRequests = 0,
    failureRate = '0.00%',
    peakConcurrency = 0,
    peakConcurrencyTime = '--:--',
    activeUsers = 0,
    privateShare = '0.00%',
    cacheHitRate = '0.0%',
    avgPromptTokens = '0',
    avgCompletionTokens = '0',
  } = stats;

  const isHighFailure = parseFloat(failureRate) >= 1.0 && failedRequests > 0;

  const cardsData = [
    // 行 1: Token 与请求质量
    {
      key: 'tokens',
      title: t('总 Token 消耗'),
      value: totalTokensFormatted,
      exactValue: totalTokensExact,
      subText: totalTokensExact,
      icon: <Coins size={16} className='text-blue-500' />,
      badgeColor: 'blue',
      clickable: false,
    },
    {
      key: 'valid_requests',
      title: t('有效请求'),
      value: Number(validRequests).toLocaleString(),
      subText: `${t('成功率')} ${successRate}`,
      subColor: 'text-emerald-600 dark:text-emerald-400 font-medium',
      icon: <CheckCircle2 size={16} className='text-emerald-500' />,
      badgeColor: 'emerald',
      clickable: true,
      onClick: () => navigate('/console/log?type=2'),
    },
    {
      key: 'failed_requests',
      title: t('失败请求'),
      value: Number(failedRequests).toLocaleString(),
      valueColor: isHighFailure
        ? 'text-red-500 dark:text-red-400'
        : 'text-gray-900 dark:text-gray-100',
      subText: `${t('占')} ${failureRate}`,
      subColor: isHighFailure
        ? 'text-red-500 dark:text-red-400 font-semibold'
        : 'text-gray-400 dark:text-gray-500',
      icon: (
        <AlertCircle
          size={16}
          className={
            isHighFailure ? 'text-red-500 dark:text-red-400' : 'text-gray-400'
          }
        />
      ),
      badgeColor: isHighFailure ? 'red' : 'gray',
      clickable: true,
      onClick: () => navigate('/console/log?type=5'),
      tooltip: t('点击可跳转至日志查看失败原因明细'),
    },

    // 行 2: 并发、活跃与自建价值
    {
      key: 'peak_concurrency',
      title: t('时段峰值并发'),
      value: peakConcurrency,
      subText: `@ ${peakConcurrencyTime}`,
      subColor: 'text-gray-500 dark:text-gray-400 font-mono',
      icon: <TrendingUp size={16} className='text-indigo-500' />,
      badgeColor: 'indigo',
      clickable: false,
    },
    {
      key: 'active_users',
      title: t('时段活跃用户'),
      value: activeUsers,
      subText: t('成功请求去重'),
      subColor: 'text-gray-400 dark:text-gray-500',
      icon: <Users size={16} className='text-purple-500' />,
      badgeColor: 'purple',
      clickable: !!onUserCardClick,
      onClick: onUserCardClick,
      tooltip: t('点击可滚动定位到底部用户排行表'),
    },
    {
      key: 'private_share',
      title: t('私有化占比'),
      value: privateShare,
      valueColor: 'text-emerald-700 dark:text-emerald-400',
      subText: t('本地部署合计'),
      subColor: 'text-gray-500 dark:text-gray-400',
      icon: <ShieldCheck size={16} className='text-emerald-600' />,
      badgeColor: 'emerald',
      clickable: false,
      tooltip: t('本地私有集群部署模型占总消耗的比例'),
    },

    // 行 3: 缓存命中与输入输出规模
    {
      key: 'cache_hit_rate',
      title: t('缓存命中率'),
      value: cacheHitRate,
      valueColor: 'text-cyan-600 dark:text-cyan-400',
      subText: t('总输入缓存 (Prompt Cache)'),
      subColor: 'text-gray-400 dark:text-gray-500',
      icon: <Zap size={16} className='text-cyan-500' />,
      badgeColor: 'cyan',
      clickable: false,
    },
    {
      key: 'avg_prompt',
      title: t('平均输入 tokens'),
      value: avgPromptTokens,
      subText: t('每请求 prompt'),
      subColor: 'text-gray-400 dark:text-gray-500',
      icon: <ArrowDownLeft size={16} className='text-amber-500' />,
      badgeColor: 'amber',
      clickable: false,
    },
    {
      key: 'avg_completion',
      title: t('平均输出 tokens'),
      value: avgCompletionTokens,
      subText: t('每请求 completion'),
      subColor: 'text-gray-400 dark:text-gray-500',
      icon: <ArrowUpRight size={16} className='text-orange-500' />,
      badgeColor: 'orange',
      clickable: false,
    },
  ];

  return (
    <div className='mb-4'>
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5'>
        {cardsData.map((card) => {
          const content = (
            <div
              key={card.key}
              onClick={card.onClick}
              className={`relative overflow-hidden rounded-2xl p-4 bg-white dark:bg-semi-color-bg-1 border border-gray-100 dark:border-zinc-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-200 ${
                card.clickable
                  ? 'cursor-pointer hover:shadow-md hover:border-gray-300/80 dark:hover:border-zinc-700 hover:-translate-y-0.5'
                  : ''
              }`}
            >
              {/* 卡片头部：标题与图标 */}
              <div className='flex items-center justify-between mb-2'>
                <span className='text-xs font-medium text-gray-500 dark:text-gray-400'>
                  {card.title}
                </span>
                <div className='p-1.5 rounded-lg bg-gray-50/90 dark:bg-zinc-800/90 text-gray-400 dark:text-gray-300'>
                  {card.icon}
                </div>
              </div>

              {/* 核心主数字 */}
              <div className='my-1'>
                <Skeleton
                  loading={loading}
                  active
                  placeholder={
                    <Skeleton.Paragraph
                      active
                      rows={1}
                      style={{ width: '80px', height: '28px' }}
                    />
                  }
                >
                  <div
                    className={`text-2xl md:text-3xl font-extrabold tracking-tight font-sans ${
                      card.valueColor || 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {card.value}
                  </div>
                </Skeleton>
              </div>

              {/* 辅助副文案 */}
              <div
                className={`text-xs mt-1.5 flex items-center gap-1 ${
                  card.subColor || 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {card.subText}
              </div>
            </div>
          );

          if (card.tooltip) {
            return (
              <Tooltip key={card.key} content={card.tooltip}>
                {content}
              </Tooltip>
            );
          }
          return content;
        })}
      </div>
    </div>
  );
}
