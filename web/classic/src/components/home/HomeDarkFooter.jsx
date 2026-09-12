import React from 'react';
import { useTranslation } from 'react-i18next';

export default function HomeDarkFooter({ systemName, version }) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className='w-full border-t border-white/10 bg-black/40 backdrop-blur-xl'>
      <div className='max-w-[1240px] mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/50'>
        <div className='flex items-center gap-3'>
          <span className='font-semibold text-white/80'>{systemName || 'New API'}</span>
          {version && (
            <span className='px-2 py-0.5 rounded-full bg-white/10 font-mono text-[10px] text-white/70'>
              v{version}
            </span>
          )}
          <span>·</span>
          <span>© {year} All rights reserved.</span>
        </div>

        <div className='flex items-center gap-6'>
          <a
            href='https://github.com/QuantumNous/new-api'
            target='_blank'
            rel='noopener noreferrer'
            className='hover:text-white transition-colors'
          >
            GitHub
          </a>
          <a
            href='https://docs.newapi.ai/'
            target='_blank'
            rel='noopener noreferrer'
            className='hover:text-white transition-colors'
          >
            {t('文档')}
          </a>
          <span className='text-white/20'>|</span>
          <span className='text-white/40'>Unified AI Model Gateway</span>
        </div>
      </div>
    </footer>
  );
}
