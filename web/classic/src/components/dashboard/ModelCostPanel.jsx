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
import { Card, Progress, Tag, Typography, Tooltip } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { Cpu, Server, Info, ShieldCheck, Sparkles } from 'lucide-react';

const { Text } = Typography;

const BAR_COLORS = [
  '#1d4ed8', // 经典深蓝
  '#047857', // 墨绿
  '#7c3aed', // 紫色
  '#0e7490', // 青色
  '#ea580c', // 橙色
  '#d97706', // 琥珀
  '#db2777', // 玫红
  '#4f46e5', // 靛蓝
];

export default function ModelCostPanel({
  modelDistribution = [],
  privateShare = '0.00%',
  failureRate = '0.00%',
  upstreamDetails = [],
  totalTokens = 0,
  t,
}) {
  return (
    <Card
      className='mb-4 !rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm'
      title={
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Cpu size={18} className='text-blue-600' />
            <span className='font-semibold text-base text-gray-800 dark:text-gray-100'>
              {t('模型占比与算力价值折算')}
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <Tag color='green' shape='circle' size='small'>
              <ShieldCheck size={12} className='mr-1 inline' />
              {t('私有化分流')} {privateShare}
            </Tag>
          </div>
        </div>
      }
      bodyStyle={{ padding: '16px 20px' }}
    >
      {/* 模型占比列表 */}
      <div className='space-y-4 mb-5'>
        {modelDistribution.length === 0 ? (
          <div className='text-center py-6 text-gray-400 text-sm'>
            {t('暂无时段模型调用数据')}
          </div>
        ) : (
          modelDistribution.map((item, index) => {
            const barColor = BAR_COLORS[index % BAR_COLORS.length];
            return (
              <div
                key={item.model_name || index}
                className='flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-gray-50/70 dark:hover:bg-gray-800/60 p-2 rounded-xl transition-colors'
              >
                {/* 左侧：标识点与模型名称 */}
                <div className='flex items-center gap-2.5 min-w-[200px]'>
                  <span
                    className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                    style={{ backgroundColor: barColor }}
                  />
                  <span className='font-medium text-sm text-gray-800 dark:text-gray-200 truncate'>
                    {item.model_name}
                  </span>
                  {item.isPrivate ? (
                    <Tag size='small' color='teal' shape='circle'>
                      {t('本地部署')}
                    </Tag>
                  ) : (
                    <Tag size='small' color='blue' shape='circle'>
                      {t('公共商业')}
                    </Tag>
                  )}
                </div>

                {/* 中间：进度条 */}
                <div className='flex-1 max-w-md mx-2'>
                  <Progress
                    percent={parseFloat(item.percent) || 0}
                    stroke={barColor}
                    showInfo={false}
                    size='small'
                    style={{ height: 8 }}
                  />
                </div>

                {/* 右侧：百分比、Token 数量与价格标签 */}
                <div className='flex items-center justify-end gap-3 flex-shrink-0 text-sm'>
                  <span className='font-semibold text-gray-700 dark:text-gray-300 w-14 text-right'>
                    {item.percent}%
                  </span>
                  <span className='text-gray-400 dark:text-gray-500 text-xs w-20 text-right'>
                    {item.formattedTokens}
                  </span>

                  {item.isPrivate ? (
                    <Tag
                      color='teal'
                      shape='circle'
                      size='large'
                      className='!font-medium'
                    >
                      <Sparkles size={12} className='mr-1 inline text-teal-600' />
                      {t('折算')} ¥{item.costRmb}
                    </Tag>
                  ) : (
                    <Tag
                      color='amber'
                      shape='circle'
                      size='large'
                      className='!font-medium'
                    >
                      ¥{item.costRmb}
                    </Tag>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 底部摘要卡片：私有化占比、上游落点明细与折算规则 */}
      <div className='bg-gray-50/90 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100/90 dark:border-gray-700/60 text-xs text-gray-600 dark:text-gray-300 leading-relaxed space-y-2'>
        <div className='flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-200'>
          <span className='text-emerald-700 dark:text-emerald-400 font-bold'>
            {t('私有化占比')} {privateShare} ({t('本地部署合计')})
          </span>
          <span>·</span>
          <span className='text-gray-600 dark:text-gray-300'>
            {t('失败率')} {failureRate}{' '}
            {parseFloat(failureRate) < 2.0 ? (
              <span className='text-emerald-600 dark:text-emerald-400'>({t('正常')})</span>
            ) : (
              <span className='text-red-500 dark:text-red-400'>({t('偏高')})</span>
            )}
          </span>
        </div>

        {upstreamDetails.length > 0 && (
          <div>
            <span className='font-medium text-gray-700 dark:text-gray-300'>
              {t('上游实际落点明细')} (tokens)：
            </span>
            <span className='text-gray-500 dark:text-gray-400'>
              {upstreamDetails
                .map((up) => `${up.name} ${up.formattedTokens}`)
                .join(' | ')}
            </span>
          </div>
        )}

        <div className='text-gray-400 dark:text-gray-500 text-[11px] pt-1 border-t border-gray-200/60 dark:border-gray-700/60'>
          <Info size={12} className='inline mr-1 -mt-0.5 text-gray-400 dark:text-gray-500' />
          {t(
            '折算规则：统一参考 DeepSeek / 通义千问官网商业阶梯价（输入 3 / 缓存命中 0.1 / 输出 9 元/百万 tokens）进行等效成本节约核算，量化私有自建集群算力 ROI。',
          )}
        </div>
      </div>
    </Card>
  );
}
