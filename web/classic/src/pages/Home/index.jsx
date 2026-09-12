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

import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { API } from '../../helpers';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { StatusContext } from '../../context/Status';
import NoticeModal from '../../components/layout/NoticeModal';

import '../../components/home/harness.css';
import DeepSeekHeroFluid from '../../components/home/DeepSeekHeroFluid';
import DeepSeekGrid from '../../components/home/DeepSeekGrid';
import DeepSeekWhale from '../../components/home/DeepSeekWhale';
import DeepSeekHeader from '../../components/home/DeepSeekHeader';
import HeroTerminalCard from '../../components/home/HeroTerminalCard';

const Home = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);

  const isEn = i18n.language?.startsWith('en');
  const heroLogo = statusState?.status?.logo || '/new-api-icon.png';
  const docsLink = statusState?.status?.docs_link || 'https://docs.newapi.pro';

  return (
    <div
      data-theme='dark'
      className='ds-home-scope relative w-full min-h-screen overflow-hidden select-none'
    >
      {/* Top Floating Transparent Navigation */}
      <DeepSeekHeader />

      <main className='relative flex flex-col w-full h-screen justify-center'>
        <section className='relative flex items-center w-full h-full ds-hero-height'>
          {/* Layer 1: WebGL2 Fluid Simulation Canvas */}
          <div
            className='absolute inset-0 z-0 overflow-hidden'
            style={{
              mask: 'linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)',
              WebkitMask:
                'linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)',
            }}
          >
            <DeepSeekHeroFluid />
          </div>

          {/* Layer 2: Interactive Dot Grid Canvas */}
          <div
            className='absolute inset-0 z-[5] hidden md:block pointer-events-none'
            style={{
              mask: 'linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)',
              WebkitMask:
                'linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)',
            }}
          >
            <DeepSeekGrid
              lineColor='rgba(255, 255, 255,'
              dotColor='rgba(255, 255, 255,'
              lineOpacity={0.08}
              dotOpacity={0.16}
            />
          </div>

          {/* Layer 3: 3D logo digitiles in screen blend mode */}
          <div
            className='absolute inset-0 z-[2] hidden md:flex items-center justify-center pointer-events-none overflow-hidden'
            style={{ mixBlendMode: 'screen' }}
          >
            <div className='w-[800px] h-[800px] ml-[100px] shrink-0'>
              <DeepSeekWhale src={heroLogo} loose={1} />
            </div>
          </div>

          {/* Layer 4: Hero Content Container */}
          <div className='relative z-10 ds-container grid grid-cols-1 gap-9 items-center pt-24 pb-12 md:grid-cols-[60fr_40fr]'>
            {/* Left Column: Heading, description, and CTA buttons */}
            <div className='flex flex-col gap-7 order-1'>
              <div
                className='ds-hero-enter flex flex-col gap-4 items-start'
                style={{
                  '--enter-y': '24px',
                  '--enter-blur': '10px',
                  animationDuration: '0.9s',
                }}
              >
                <p
                  data-hero-preview-label='true'
                  className='whitespace-nowrap font-ds-sans text-[15px] font-medium leading-none tracking-[-0.01em] text-white/90 sm:text-[16px] md:text-[17px] pl-[3px]'
                >
                  {isEn
                    ? 'Next-Gen Unified AI API Gateway'
                    : '新一代大模型接口聚合网关'}
                </p>
                <h1
                  className='ds-text-hero text-ds-primary !leading-[1.2]'
                  style={{ letterSpacing: '0.2px' }}
                >
                  {isEn
                    ? 'All Models, One Unified API'
                    : '汇聚全网模型，统一接口分发'}
                </h1>
              </div>

              <div
                className='ds-hero-enter max-w-[580px] flex flex-col gap-2'
                style={{
                  '--enter-y': '20px',
                  '--enter-blur': '8px',
                  animationDelay: '0.15s',
                }}
              >
                <p className='ds-text-body text-ds-description'>
                  {isEn
                    ? 'Aggregates 40+ mainstream AI providers including OpenAI, Claude, Gemini, and DeepSeek, offering high-availability load balancing and smart routing.'
                    : '聚合 OpenAI、Claude、Gemini、DeepSeek 等 40+ 主流大模型供应商，提供高可用负载均衡与智能调度。'}
                </p>
                <p className='ds-text-body text-ds-description'>
                  {isEn
                    ? 'Seamless drop-in replacement for standard OpenAI APIs. Built-in support for channel groups, token metering, rate limiting, and enterprise key management.'
                    : '标准 OpenAI 接口规范无缝平替，开箱即用；支持多渠道分组、按量计费、高并发限流与企业级密钥管理。'}
                </p>
              </div>

              {/* Desktop CTA Action Buttons */}
              <div
                className='ds-hero-enter hidden md:flex flex-wrap items-center gap-[14px] mt-2'
                style={{
                  '--enter-y': '16px',
                  animationDuration: '0.7s',
                  animationDelay: '0.3s',
                }}
              >
                {/* 1. Enter Console */}
                <Link to='/console' className='ds-btn-primary ds-btn-m'>
                  <svg width='15' height='15' viewBox='0 0 16 16' fill='none'>
                    <path d='M4 3.5V12.5L12 8L4 3.5Z' fill='currentColor' />
                  </svg>
                  <span>{isEn ? 'Get Started' : t('获取密钥')}</span>
                </Link>

                {/* 2. Documentation */}
                {docsLink && (
                  <a
                    href={docsLink}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='ds-btn-secondary ds-btn-m'
                  >
                    <svg
                      width='15'
                      height='15'
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                    >
                      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                      <polyline points='14 2 14 8 20 8' />
                      <line x1='16' y1='13' x2='8' y2='13' />
                      <line x1='16' y1='17' x2='8' y2='17' />
                      <polyline points='10 9 9 9 8 9' />
                    </svg>
                    <span>{isEn ? 'Documentation' : t('开发文档')}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Right Column: Interactive Code Terminal Card */}
            <div className='flex flex-col gap-3 order-2 justify-center items-center md:items-end w-full'>
              <HeroTerminalCard />
            </div>

            {/* Mobile Actions Container */}
            <div className='flex md:hidden order-3 w-full gap-3'>
              <Link
                to='/console'
                className='ds-btn-primary ds-btn-m flex-1 justify-center'
              >
                <span>{isEn ? 'Get Started' : t('获取密钥')}</span>
              </Link>
              {docsLink && (
                <a
                  href={docsLink}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='ds-btn-secondary ds-btn-m flex-1 justify-center'
                >
                  <span>{isEn ? 'Docs' : t('开发文档')}</span>
                </a>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
