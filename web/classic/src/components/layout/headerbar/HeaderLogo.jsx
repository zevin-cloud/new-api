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

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Typography, Tag } from '@douyinfe/semi-ui';
import SkeletonWrapper from '../components/SkeletonWrapper';

const HeaderLogo = ({
  homePath = '/pricing',
  isMobile,
  isConsoleRoute,
  logo,
  logoLoaded,
  isLoading,
  systemName,
  version,
  isSelfUseMode,
  isDemoSiteMode,
  t,
}) => {
  const location = useLocation();
  const isOnDark = location.pathname === '/';

  if (isMobile && isConsoleRoute) {
    return null;
  }

  return (
    <Link to={homePath} className='group flex items-center gap-2'>
      <div className='relative w-8 h-8 md:w-8 md:h-8'>
        <SkeletonWrapper loading={isLoading || !logoLoaded} type='image' />
        <img
          src={logo}
          alt='logo'
          className={`absolute inset-0 w-full h-full transition-all duration-200 group-hover:scale-110 rounded-full ${!isLoading && logoLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>
      <div className='hidden md:flex items-center gap-2'>
        <div className='flex items-center gap-2'>
          <SkeletonWrapper
            loading={isLoading}
            type='title'
            width={120}
            height={24}
          >
            <Typography.Title
              heading={4}
              className={`!text-lg !font-semibold !mb-0 ${isOnDark ? '!text-white' : ''}`}
            >
              {systemName}
            </Typography.Title>
          </SkeletonWrapper>
          {version && !isLoading && (
            <span
              className='hidden sm:inline-flex items-center rounded-[8px] p-[1px]'
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.04) 65%, rgba(255,255,255,0.4) 100%)',
                boxShadow:
                  '0 0 16px rgba(255,255,255,0.08), 0 0 32px rgba(255,255,255,0.04)',
              }}
            >
              <span className='truncate pt-[2px] pb-[2px] rounded-[7px] font-mono text-[10px] font-medium leading-none px-[6px] bg-black/30 text-white/90'>
                {version}
              </span>
            </span>
          )}
          {(isSelfUseMode || isDemoSiteMode) && !isLoading && (
            <Tag
              color={isSelfUseMode ? 'purple' : 'blue'}
              className='text-xs px-1.5 py-0.5 rounded whitespace-nowrap shadow-sm'
              size='small'
              shape='circle'
            >
              {isSelfUseMode ? t('自用模式') : t('演示站点')}
            </Tag>
          )}
        </div>
      </div>
    </Link>
  );
};

export default HeaderLogo;
