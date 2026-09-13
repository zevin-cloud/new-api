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

import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Form,
  Avatar,
  Typography,
  Tag,
  Button,
} from '@douyinfe/semi-ui';
import { IconChevronDown, IconChevronUp } from '@douyinfe/semi-icons';
import { DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const ModelPricingSection = ({
  values,
  formApi,
  isCustomPricing,
  hasSystemDefault,
  onResetToDefault,
}) => {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const billingMode = values?.billing_mode || 'per-token';
  const inputPrice = values?.input_price;
  const completionPrice = values?.completion_price;

  // Calculate corresponding ratio: 1 token ratio = input_price / 2
  const calculatedRatio = useMemo(() => {
    if (!inputPrice || isNaN(Number(inputPrice))) return null;
    const num = Number(inputPrice);
    if (num === 0) return '0';
    return parseFloat((num / 2).toFixed(6)).toString();
  }, [inputPrice]);

  // Calculate completion ratio: completion_price / input_price
  const calculatedCompletionRatio = useMemo(() => {
    if (
      !inputPrice ||
      !completionPrice ||
      isNaN(Number(inputPrice)) ||
      isNaN(Number(completionPrice))
    ) {
      return null;
    }
    const inp = Number(inputPrice);
    const comp = Number(completionPrice);
    if (inp === 0) return null;
    return parseFloat((comp / inp).toFixed(4)).toString();
  }, [inputPrice, completionPrice]);

  return (
    <Card className='!rounded-2xl shadow-sm border-0 mt-3'>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center'>
          <Avatar size='small' color='amber' className='mr-2 shadow-md'>
            <DollarSign size={16} />
          </Avatar>
          <div>
            <div className='flex items-center gap-2'>
              <Text className='text-lg font-medium'>{t('模型定价设置')}</Text>
              {isCustomPricing ? (
                <Tag color='green' size='small' shape='circle'>
                  {t('已自定义定价')}
                </Tag>
              ) : hasSystemDefault ? (
                <Tag color='blue' size='small' shape='circle'>
                  {t('系统默认倍率')}
                </Tag>
              ) : (
                <Tag color='grey' size='small' shape='circle'>
                  {t('未设置定价')}
                </Tag>
              )}
            </div>
            <div className='text-xs text-gray-500'>
              {t(
                '配置在中转调用时的扣费规则，与【系统设置 -> 倍率设置】实时双向同步',
              )}
            </div>
          </div>
        </div>
        {isCustomPricing && onResetToDefault && (
          <Button
            size='small'
            type='tertiary'
            theme='borderless'
            onClick={onResetToDefault}
          >
            {t('清除自定义并重置')}
          </Button>
        )}
      </div>

      <Row gutter={12}>
        <Col span={24}>
          <Form.RadioGroup
            field='billing_mode'
            label={t('计费模式')}
            type='button'
            size='small'
            className='mb-2'
          >
            <Form.Radio value='per-token'>
              {t('按量计费 (按 Token 计费)')}
            </Form.Radio>
            <Form.Radio value='per-request'>
              {t('按次计费 (按请求固定扣费)')}
            </Form.Radio>
          </Form.RadioGroup>
        </Col>

        {billingMode === 'per-token' ? (
          <>
            <Col span={12}>
              <Form.Input
                field='input_price'
                label={t('输入价格')}
                placeholder='0.00'
                suffix='$/1M tokens'
                showClear
                extraText={
                  calculatedRatio !== null
                    ? `${t('对应模型倍率')}: ${calculatedRatio}`
                    : t('留空表示不设置自定义定价')
                }
              />
            </Col>
            <Col span={12}>
              <Form.Input
                field='completion_price'
                label={t('输出价格')}
                placeholder='0.00'
                suffix='$/1M tokens'
                showClear
                extraText={
                  calculatedCompletionRatio !== null
                    ? `${t('对应补全倍率')}: ${calculatedCompletionRatio}x`
                    : t('留空则与输入价格相同(1x)')
                }
              />
            </Col>

            <Col span={24}>
              <div className='mt-1 mb-2'>
                <Button
                  type='tertiary'
                  size='small'
                  theme='borderless'
                  icon={showAdvanced ? <IconChevronUp /> : <IconChevronDown />}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced
                    ? t('收起高级价格项')
                    : t('展开高级价格项 (缓存、音频、图片)')}
                </Button>

                {showAdvanced && (
                  <div
                    className='p-3 mt-2 rounded-xl'
                    style={{
                      backgroundColor: 'var(--semi-color-fill-0)',
                      border: '1px solid var(--semi-color-border)',
                    }}
                  >
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Input
                          field='cache_price'
                          label={t('缓存命中价格')}
                          placeholder='0.00'
                          suffix='$/1M tokens'
                          showClear
                        />
                      </Col>
                      <Col span={12}>
                        <Form.Input
                          field='create_cache_price'
                          label={t('缓存写入价格')}
                          placeholder='0.00'
                          suffix='$/1M tokens'
                          showClear
                        />
                      </Col>
                      <Col span={12}>
                        <Form.Input
                          field='audio_input_price'
                          label={t('音频输入价格')}
                          placeholder='0.00'
                          suffix='$/1M tokens'
                          showClear
                        />
                      </Col>
                      <Col span={12}>
                        <Form.Input
                          field='audio_output_price'
                          label={t('音频输出价格')}
                          placeholder='0.00'
                          suffix='$/1M tokens'
                          showClear
                        />
                      </Col>
                      <Col span={12}>
                        <Form.Input
                          field='image_ratio'
                          label={t('图片倍率')}
                          placeholder='例如：1.0'
                          showClear
                          extraText={t('默认留空即按 1.0 计算')}
                        />
                      </Col>
                    </Row>
                  </div>
                )}
              </div>
            </Col>
          </>
        ) : (
          <Col span={24}>
            <Form.Input
              field='fixed_price'
              label={t('每次调用价格')}
              placeholder='0.00'
              suffix='$/次'
              showClear
              extraText={t('每次请求调用成功后固定扣除此金额（单位：美元）')}
            />
          </Col>
        )}
      </Row>
    </Card>
  );
};

export default ModelPricingSection;
