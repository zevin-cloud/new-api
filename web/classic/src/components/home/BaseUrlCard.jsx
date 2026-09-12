import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { copy, showSuccess } from '../../helpers';
import { API_ENDPOINTS } from '../../constants/common.constant';
import { IconCopy, IconTick } from '@douyinfe/semi-icons';

export default function BaseUrlCard({ serverAddress }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [endpointIndex, setEndpointIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('base_url');

  useEffect(() => {
    const timer = setInterval(() => {
      setEndpointIndex((prev) => (prev + 1) % API_ENDPOINTS.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const currentEndpoint = API_ENDPOINTS[endpointIndex] || '/v1';
  const effectiveAddress = serverAddress || window.location.origin;

  const curlSnippet = `curl ${effectiveAddress}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $API_KEY" \\
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'`;

  const handleCopy = async (e) => {
    e?.preventDefault?.();
    const textToCopy = activeTab === 'base_url' ? effectiveAddress : curlSnippet;
    const ok = await copy(textToCopy);
    if (ok) {
      setCopied(true);
      showSuccess(t('已复制到剪切板'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className='w-full max-w-2xl my-6 text-left relative'>
      {/* 选项卡标签栏（DeepSeek Harness 像素级风格） */}
      <div className='flex items-center gap-1.5 ml-1.5'>
        <button
          type='button'
          onClick={() => setActiveTab('base_url')}
          className={`px-4 py-2 text-[13px] font-medium transition-all cursor-pointer rounded-t-[8px] border border-b-0 ${
            activeTab === 'base_url'
              ? 'text-white bg-black/40 backdrop-blur-xl border-white/[0.12] shadow-sm'
              : 'text-neutral-400 hover:text-white bg-transparent border-transparent'
          }`}
        >
          {t('一键使用')}
        </button>
        <button
          type='button'
          onClick={() => setActiveTab('curl')}
          className={`px-4 py-2 text-[13px] font-medium transition-all cursor-pointer rounded-t-[8px] border border-b-0 ${
            activeTab === 'curl'
              ? 'text-white bg-black/40 backdrop-blur-xl border-white/[0.12] shadow-sm'
              : 'text-neutral-400 hover:text-white bg-transparent border-transparent'
          }`}
        >
          {t('调用示例')}
        </button>
      </div>

      {/* 终端卡片窗口主体 */}
      <div className='rounded-2xl border border-white/[0.1] bg-black/35 backdrop-blur-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.6)] -mt-[1px] transition-all duration-300'>
        {/* 顶部标题栏：macOS 3 色圆点与复制按钮 */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]'>
          <div className='flex items-center gap-2'>
            <span className='w-[11px] h-[11px] rounded-full bg-[#ff5f57] inline-block shadow-[0_0_8px_rgba(255,95,87,0.4)]' />
            <span className='w-[11px] h-[11px] rounded-full bg-[#febc2e] inline-block shadow-[0_0_8px_rgba(254,188,46,0.4)]' />
            <span className='w-[11px] h-[11px] rounded-full bg-[#28c840] inline-block shadow-[0_0_8px_rgba(40,200,64,0.4)]' />

            <span className='ml-3 text-xs font-mono text-neutral-400/80 hidden sm:inline-block'>
              {activeTab === 'base_url' ? 'api-gateway' : 'bash — curl'}
            </span>
          </div>

          <div className='flex items-center gap-3'>
            {/* 动态端点展示 */}
            {activeTab === 'base_url' && (
              <div className='hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-[#4d6bfe]/10 border border-[#4d6bfe]/25 text-[#60a5fa] text-xs font-mono'>
                <span className='mr-1 text-[#3b82f6]'>/</span>
                <span className='truncate max-w-[150px]'>{currentEndpoint.replace(/^\//, '')}</span>
              </div>
            )}

            {/* 复制按钮 */}
            <button
              type='button'
              onClick={handleCopy}
              className='flex items-center gap-1.5 text-neutral-400 hover:text-white text-xs font-medium cursor-pointer transition-colors px-2.5 py-1 rounded-md hover:bg-white/[0.06]'
            >
              {copied ? (
                <>
                  <IconTick className='text-emerald-400' />
                  <span className='text-emerald-400 font-mono'>{t('已复制')}</span>
                </>
              ) : (
                <>
                  <IconCopy className='text-neutral-400' />
                  <span className='font-mono'>{t('复制')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 终端内容区 */}
        <div className='p-4 sm:p-5 font-mono text-[13px] sm:text-[14px] leading-relaxed select-all overflow-x-auto'>
          {activeTab === 'base_url' ? (
            <div className='flex flex-wrap items-center gap-2 text-white/95'>
              <span className='select-none text-[#4d6bfe] font-bold font-mono text-base'>$</span>
              <span className='text-neutral-400/80 select-none'># API Base URL:</span>
              <code className='text-white font-medium truncate'>{effectiveAddress}</code>
            </div>
          ) : (
            <pre className='text-neutral-200 whitespace-pre-wrap leading-relaxed m-0 font-mono text-xs sm:text-sm'>
              <span className='select-none text-[#4d6bfe] font-bold'>$ </span>
              {curlSnippet}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
