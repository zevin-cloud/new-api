import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Fallback copy failed', err);
  }
  document.body.removeChild(textArea);
  return Promise.resolve();
}

export default function HeroTerminalCard() {
  const { i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [tab, setTab] = useState('curl');
  const [copied, setCopied] = useState(false);

  const isEn = i18n.language?.startsWith('en');
  const serverAddress =
    statusState?.status?.server_address || (typeof window !== 'undefined' ? window.location.origin : 'https://api.example.com');

  const CMD_CURL = `curl ${serverAddress}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-key" \\
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`;

  const CMD_DOCKER = `docker run -d --restart always --name new-api \\
  -p 3000:3000 \\
  -v /data:/data \\
  quantumnous/new-api:latest`;

  const activeCmd = tab === 'curl' ? CMD_CURL : CMD_DOCKER;

  const handleCopy = () => {
    copyText(activeCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div
      className='ds-hero-enter flex flex-col gap-3 w-full max-w-[540px]'
      style={{
        '--enter-y': '20px',
        animationDuration: '0.9s',
        animationDelay: '0.4s',
      }}
    >
      {/* Tab bar */}
      <div className='flex gap-1 px-1 ml-[6px]'>
        <button
          type='button'
          onClick={() => setTab('curl')}
          className={`px-4 py-2 text-[13px] font-medium transition-all cursor-pointer rounded-t-[8px] border border-b-0 ${
            tab === 'curl'
              ? 'text-white bg-black/25 backdrop-blur-xl border-white/[0.08]'
              : 'text-white/60 hover:text-white bg-transparent border-transparent'
          }`}
        >
          {isEn ? 'cURL API' : '快速调用 (cURL)'}
        </button>
        <button
          type='button'
          onClick={() => setTab('docker')}
          className={`px-4 py-2 text-[13px] font-medium transition-all cursor-pointer rounded-t-[8px] border border-b-0 ${
            tab === 'docker'
              ? 'text-white bg-black/25 backdrop-blur-xl border-white/[0.08]'
              : 'text-white/60 hover:text-white bg-transparent border-transparent'
          }`}
        >
          {isEn ? 'Docker Run' : '一键部署 (Docker)'}
        </button>
      </div>

      {/* Terminal window */}
      <div className='rounded-ds-media border border-white/[0.08] bg-black/25 backdrop-blur-xl overflow-hidden -mt-[13px] shadow-2xl'>
        {/* Terminal Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-white/[0.08]'>
          <div className='flex items-center gap-[7px]'>
            <span className='w-[11px] h-[11px] rounded-full bg-[#ff5f57]' />
            <span className='w-[11px] h-[11px] rounded-full bg-[#febc2e]' />
            <span className='w-[11px] h-[11px] rounded-full bg-[#28c840]' />
            <span className='text-[11px] text-white/40 font-mono ml-2 hidden sm:inline'>
              {tab === 'curl' ? 'bash — openai-compatible API' : 'docker — quick deployment'}
            </span>
          </div>

          <button
            type='button'
            onClick={handleCopy}
            className='flex items-center gap-1.5 text-white/60 text-[12px] cursor-pointer hover:text-white transition-colors'
          >
            {copied ? (
              <svg width='14' height='14' viewBox='0 0 16 16' fill='none'>
                <path
                  d='M15.0498 3.92579L8.49512 12.3818C8.25774 12.6881 8.04517 12.9645 7.84668 13.1689C7.63957 13.3823 7.38732 13.5841 7.04492 13.6719C6.86373 13.7183 6.6757 13.7346 6.48926 13.7197C6.13666 13.6915 5.8528 13.5355 5.6123 13.3604C5.38201 13.1926 5.12573 12.9567 4.83984 12.6953L1.03125 9.21289L1.96875 8.1875L5.77734 11.6699C6.08684 11.9529 6.27773 12.1249 6.43066 12.2363C6.50183 12.2882 6.54699 12.3135 6.57324 12.3252C6.58525 12.3305 6.59269 12.3322 6.5957 12.333C6.59802 12.3336 6.59961 12.334 6.59961 12.334C6.63317 12.3367 6.66758 12.3335 6.7002 12.3252C6.7002 12.3252 6.70211 12.3251 6.7041 12.3242C6.70698 12.3229 6.71348 12.319 6.72461 12.3115C6.74849 12.2956 6.78843 12.2642 6.84961 12.2012C6.98138 12.0654 7.13957 11.8628 7.39648 11.5313L13.9502 3.07422L15.0498 3.92579Z'
                  fill='#22c55e'
                />
              </svg>
            ) : (
              <svg
                width='14'
                height='14'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
                <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
              </svg>
            )}
            <span>{copied ? (isEn ? 'Copied' : '已复制') : (isEn ? 'Copy' : '复制')}</span>
          </button>
        </div>

        {/* Command Body */}
        <div className='p-4 sm:p-5 font-mono text-[13px] text-white/95 leading-relaxed overflow-x-auto'>
          {tab === 'curl' ? (
            <div>
              <div className='text-white/60 mb-1'># {isEn ? 'Drop-in replacement for OpenAI API' : '一键无缝替换 OpenAI 调用'}</div>
              <div>
                <span className='select-none text-[#6799fe]'>$ </span>
                curl {serverAddress}/v1/chat/completions \
              </div>
              <div className='pl-4 text-white/80'>
                -H <span className='text-[#98c379]'>"Content-Type: application/json"</span> \
              </div>
              <div className='pl-4 text-white/80'>
                -H <span className='text-[#98c379]'>"Authorization: Bearer sk-your-key"</span> \
              </div>
              <div className='pl-4 text-white/80'>
                -d <span className='text-[#e5c07b]'>{`'{"model": "deepseek-chat", "messages": [{"role": "user", "content": "Hello!"}]}'`}</span>
              </div>
            </div>
          ) : (
            <div>
              <div className='text-white/60 mb-1'># {isEn ? 'Docker quick deployment command' : 'Docker 容器化极速部署运行'}</div>
              <div>
                <span className='select-none text-[#6799fe]'>$ </span>
                docker run -d --restart always --name new-api \
              </div>
              <div className='pl-4 text-white/80'>-p 3000:3000 \</div>
              <div className='pl-4 text-white/80'>-v /data:/data \</div>
              <div className='pl-4 text-[#98c379]'>quantumnous/new-api:latest</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
