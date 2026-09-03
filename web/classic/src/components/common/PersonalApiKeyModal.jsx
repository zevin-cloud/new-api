import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Typography,
  Input,
  Banner,
  Spin,
  Tabs,
  TabPane,
} from '@douyinfe/semi-ui';
import {
  IconCopy,
  IconRefresh,
  IconEyeOpened,
  IconEyeClosed,
} from '@douyinfe/semi-icons';
import { API, copy, showError, showSuccess, renderQuota } from '../../helpers';

const { Text, Paragraph } = Typography;

const PersonalApiKeyModal = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [keyData, setKeyData] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState({
    quota: 0,
    used_quota: 0,
    request_count: 0,
  });

  const serverAddress = window.location.origin;

  const fetchTokenAndQuota = async () => {
    setLoading(true);
    try {
      const [tokenRes, selfRes] = await Promise.allSettled([
        API.get('/api/user/default-token'),
        API.get('/api/user/self'),
      ]);

      if (tokenRes.status === 'fulfilled' && tokenRes.value?.data?.success) {
        setKeyData(tokenRes.value.data.data);
      } else if (tokenRes.status === 'rejected') {
        showError(t('获取个人密钥失败'));
      }

      if (selfRes.status === 'fulfilled' && selfRes.value?.data?.success) {
        const selfData = selfRes.value.data.data;
        setQuotaInfo({
          quota: selfData.quota || 0,
          used_quota: selfData.used_quota || 0,
          request_count: selfData.request_count || 0,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    Modal.confirm({
      title: t('确认重置个人密钥？'),
      content: t('重置后，原密钥将立即失效，所有使用旧密钥的应用需更新为新密钥。'),
      okText: t('确定重置'),
      okType: 'danger',
      cancelText: t('取消'),
      onOk: async () => {
        setResetting(true);
        try {
          const res = await API.post('/api/user/default-token/reset');
          if (res?.data?.success) {
            setKeyData(res.data.data);
            showSuccess(t('密钥重置成功'));
          } else {
            showError(res?.data?.message || t('重置失败'));
          }
        } catch (err) {
          showError(err?.message || t('重置失败'));
        } finally {
          setResetting(false);
        }
      },
    });
  };

  const handleCopy = async (text, msg = t('已复制到剪切板')) => {
    const ok = await copy(text);
    if (ok) {
      showSuccess(msg);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchTokenAndQuota();
    } else {
      setShowKey(false);
    }
  }, [visible]);

  const fullKey = keyData?.key || '';
  const maskedKey = fullKey
    ? `${fullKey.slice(0, 6)}****************${fullKey.slice(-4)}`
    : '';

  const curlExample = `curl ${serverAddress}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${fullKey || 'sk-your-key'}" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "你好！"}]
  }'`;

  const pythonExample = `from openai import OpenAI

client = OpenAI(
    api_key="${fullKey || 'sk-your-key'}",
    base_url="${serverAddress}/v1"
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "你好！"}]
)
print(response.choices[0].message.content)`;

  return (
    <Modal
      title={t('我的 API 密钥与企业配额')}
      visible={visible}
      onCancel={onClose}
      footer={
        <div className='flex justify-between items-center w-full'>
          <Button
            type='danger'
            theme='borderless'
            icon={<IconRefresh />}
            loading={resetting}
            onClick={handleReset}
          >
            {t('重置密钥')}
          </Button>
          <Button type='primary' onClick={onClose}>
            {t('完成')}
          </Button>
        </div>
      }
      width={640}
    >
      <Spin spinning={loading}>
        <div className='space-y-4 py-2'>
          {/* 企业配额看板 */}
          <div className='grid grid-cols-3 gap-3 p-3.5 bg-semi-color-fill-0 dark:bg-gray-800 rounded-xl border border-semi-color-border'>
            <div>
              <Text type='tertiary' size='small' className='block mb-1'>
                {t('可用企业配额')}
              </Text>
              <Text strong className='text-base text-semi-color-primary'>
                {renderQuota(quotaInfo.quota)}
              </Text>
            </div>
            <div>
              <Text type='tertiary' size='small' className='block mb-1'>
                {t('已消耗配额')}
              </Text>
              <Text strong className='text-base text-semi-color-text-0'>
                {renderQuota(quotaInfo.used_quota)}
              </Text>
            </div>
            <div>
              <Text type='tertiary' size='small' className='block mb-1'>
                {t('累计调用次数')}
              </Text>
              <Text strong className='text-base text-semi-color-text-0'>
                {quotaInfo.request_count} {t('次')}
              </Text>
            </div>
          </div>

          <Banner
            type='info'
            description={t(
              '此密钥为您的专属调用凭证，具有您已被授权模型的调用权限。由企业统一授权配额扣减，无需个人付费。'
            )}
          />

          <div>
            <Text strong className='block mb-1.5'>
              API Key
            </Text>
            <Input
              readOnly
              value={showKey ? fullKey : maskedKey}
              suffix={
                <div className='flex items-center gap-1 mr-1'>
                  <Button
                    theme='borderless'
                    type='tertiary'
                    size='small'
                    icon={showKey ? <IconEyeClosed /> : <IconEyeOpened />}
                    onClick={() => setShowKey(!showKey)}
                  />
                  <Button
                    theme='borderless'
                    type='tertiary'
                    size='small'
                    icon={<IconCopy />}
                    onClick={() => handleCopy(fullKey, t('API Key 已复制'))}
                  />
                </div>
              }
            />
          </div>

          <div>
            <Text strong className='block mb-1.5'>
              {t('接口基址 (Base URL)')}
            </Text>
            <Input
              readOnly
              value={`${serverAddress}/v1`}
              suffix={
                <Button
                  theme='borderless'
                  type='tertiary'
                  size='small'
                  icon={<IconCopy />}
                  onClick={() =>
                    handleCopy(`${serverAddress}/v1`, t('基址已复制'))
                  }
                  className='mr-1'
                />
              }
            />
          </div>

          <div>
            <Text strong className='block mb-1.5'>
              {t('快速接入示例')}
            </Text>
            <Tabs type='line' size='small'>
              <TabPane tab='cURL' itemKey='curl'>
                <div className='relative mt-1'>
                  <pre className='bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs font-mono overflow-x-auto text-gray-800 dark:text-gray-200'>
                    {curlExample}
                  </pre>
                  <Button
                    size='small'
                    type='secondary'
                    icon={<IconCopy />}
                    onClick={() => handleCopy(curlExample)}
                    className='absolute top-2 right-2'
                  >
                    {t('复制代码')}
                  </Button>
                </div>
              </TabPane>
              <TabPane tab='Python' itemKey='python'>
                <div className='relative mt-1'>
                  <pre className='bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs font-mono overflow-x-auto text-gray-800 dark:text-gray-200'>
                    {pythonExample}
                  </pre>
                  <Button
                    size='small'
                    type='secondary'
                    icon={<IconCopy />}
                    onClick={() => handleCopy(pythonExample)}
                    className='absolute top-2 right-2'
                  >
                    {t('复制代码')}
                  </Button>
                </div>
              </TabPane>
            </Tabs>
          </div>
        </div>
      </Spin>
    </Modal>
  );
};

export default PersonalApiKeyModal;
