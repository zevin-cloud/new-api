import React, { useState, useEffect } from 'react';
import { Typography, Tabs, TabPane, Button } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { copy, showSuccess, API } from '../../../../../helpers';

const { Text } = Typography;

const ModelCodeExample = ({ modelName, t }) => {
  const [apiKey, setApiKey] = useState('');
  const serverAddress = window.location.origin;

  useEffect(() => {
    let mounted = true;
    const fetchToken = async () => {
      try {
        const res = await API.get('/api/user/default-token');
        if (mounted && res?.data?.success && res.data.data?.key) {
          setApiKey(res.data.data.key);
        }
      } catch (e) {
        // ignore if not logged in
      }
    };
    fetchToken();
    return () => {
      mounted = false;
    };
  }, []);

  const tokenPlaceholder = apiKey || 'sk-your-api-key';
  const targetModel = modelName || 'gpt-4o-mini';

  const curlCode = `curl ${serverAddress}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -d '{
    "model": "${targetModel}",
    "messages": [{"role": "user", "content": "你好！"}]
  }'`;

  const pythonCode = `from openai import OpenAI

client = OpenAI(
    api_key="${tokenPlaceholder}",
    base_url="${serverAddress}/v1"
)

response = client.chat.completions.create(
    model="${targetModel}",
    messages=[{"role": "user", "content": "你好！"}]
)
print(response.choices[0].message.content)`;

  const handleCopy = async (text) => {
    const ok = await copy(text);
    if (ok) {
      showSuccess(t ? t('已复制到剪切板') : '已复制到剪切板');
    }
  };

  return (
    <div>
      <div className='flex items-center justify-between mb-2'>
        <Text strong>{t ? t('快速接入示例') : '快速接入示例'}</Text>
        <Text type='tertiary' size='small'>
          {apiKey ? (t ? t('已带入个人专属 Key') : '已带入个人专属 Key') : ''}
        </Text>
      </div>
      <Tabs type='line' size='small'>
        <TabPane tab='cURL' itemKey='curl'>
          <div className='relative mt-1'>
            <pre className='bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs font-mono overflow-x-auto text-gray-800 dark:text-gray-200'>
              {curlCode}
            </pre>
            <Button
              size='small'
              type='secondary'
              icon={<IconCopy />}
              onClick={() => handleCopy(curlCode)}
              className='absolute top-2 right-2'
            >
              {t ? t('复制') : '复制'}
            </Button>
          </div>
        </TabPane>
        <TabPane tab='Python' itemKey='python'>
          <div className='relative mt-1'>
            <pre className='bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs font-mono overflow-x-auto text-gray-800 dark:text-gray-200'>
              {pythonCode}
            </pre>
            <Button
              size='small'
              type='secondary'
              icon={<IconCopy />}
              onClick={() => handleCopy(pythonCode)}
              className='absolute top-2 right-2'
            >
              {t ? t('复制') : '复制'}
            </Button>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default ModelCodeExample;
