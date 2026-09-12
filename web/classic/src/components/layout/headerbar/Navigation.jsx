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
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import SkeletonWrapper from '../components/SkeletonWrapper';

const Navigation = ({
  mainNavLinks,
  supportNavLinks = [],
  isMobile,
  isLoading,
  userState,
  pricingRequireAuth,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const renderNavLinks = () => {
    const baseClasses =
      'flex-shrink-0 flex items-center gap-1 transition-colors duration-200 ease-in-out';
    const hoverClasses = 'hover:text-semi-color-primary';
    const spacingClasses = isMobile ? 'px-2 py-1' : 'px-3 py-1.5';

    const commonLinkClasses = `${baseClasses} ${spacingClasses} ${hoverClasses}`;

    const displayLinks = isMobile
      ? mainNavLinks.filter((link) => !['docs', 'about'].includes(link.itemKey))
      : mainNavLinks;

    return displayLinks.map((link) => {
      const linkContent = <span>{link.text}</span>;

      const isOnDark = location.pathname === '/';

      if (link.isExternal) {
        return (
          <a
            key={link.itemKey}
            href={link.externalLink}
            target='_blank'
            rel='noopener noreferrer'
            className={`${commonLinkClasses} ${
              isOnDark ? 'text-white/85 hover:text-white' : 'text-semi-color-text-0'
            } font-medium`}
          >
            {linkContent}
          </a>
        );
      }

      let targetPath = link.to;
      if (link.itemKey === 'console' && !userState.user) {
        targetPath = '/login';
      }
      if (link.itemKey === 'pricing' && pricingRequireAuth && !userState.user) {
        targetPath = '/login';
      }

      const active =
        link.itemKey === 'console'
          ? location.pathname.startsWith('/console')
          : location.pathname === link.to;
      return (
        <Link
          key={link.itemKey}
          to={targetPath}
          aria-current={active ? 'page' : undefined}
          className={`${commonLinkClasses} ${
            active
              ? isOnDark
                ? 'text-cyan-400 font-semibold'
                : 'text-semi-color-primary font-semibold'
              : isOnDark
                ? 'text-white/85 hover:text-white font-medium'
                : 'text-semi-color-text-0 font-medium'
          }`}
        >
          {linkContent}
        </Link>
      );
    });
  };

  return (
    <nav className='flex min-w-0 flex-1 items-center gap-1 lg:gap-2 mx-2 md:mx-4 overflow-x-auto whitespace-nowrap scrollbar-hide'>
      <SkeletonWrapper
        loading={isLoading}
        type='navigation'
        count={4}
        width={60}
        height={16}
        isMobile={isMobile}
      >
        {renderNavLinks()}
        {isMobile && supportNavLinks.length > 0 && (
          <div className='ml-auto flex flex-shrink-0 items-center gap-2'>
            <Dropdown
              trigger='click'
              position='bottomRight'
              render={
                <Dropdown.Menu>
                  {supportNavLinks.map((link) => (
                    <Dropdown.Item key={link.itemKey}>
                      {link.isExternal ? (
                        <a
                          href={link.externalLink}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-semi-color-text-0'
                        >
                          {link.text}
                        </a>
                      ) : (
                        <Link to={link.to} className='text-semi-color-text-0'>
                          {link.text}
                        </Link>
                      )}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              }
            >
              <Button theme='borderless' type='tertiary'>
                {t('Help')}
              </Button>
            </Dropdown>
          </div>
        )}
      </SkeletonWrapper>
    </nav>
  );
};

export default Navigation;

