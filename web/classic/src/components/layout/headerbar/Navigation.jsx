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
      'flex-shrink-0 flex items-center gap-1 font-semibold rounded-md transition-all duration-200 ease-in-out';
    const hoverClasses = 'hover:text-semi-color-primary';
    const spacingClasses = isMobile ? 'p-1' : 'p-2';

    const commonLinkClasses = `${baseClasses} ${spacingClasses} ${hoverClasses}`;

    return mainNavLinks.map((link) => {
      const linkContent = <span>{link.text}</span>;

      if (link.isExternal) {
        return (
          <a
            key={link.itemKey}
            href={link.externalLink}
            target='_blank'
            rel='noopener noreferrer'
            className={commonLinkClasses}
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
          className={`${commonLinkClasses} ${active ? 'text-semi-color-primary bg-semi-color-fill-0' : ''}`}
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
        {supportNavLinks.length > 0 && (
          <div className='ml-auto flex flex-shrink-0 items-center gap-2'>
            {!isMobile &&
              supportNavLinks
                .filter((link) => link.itemKey === 'docs')
                .map((link) => (
                  <a
                    key={link.itemKey}
                    href={link.externalLink}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='p-2 text-semi-color-text-2 hover:text-semi-color-primary'
                  >
                    {link.text}
                  </a>
                ))}
            {(isMobile ||
              supportNavLinks.some((link) => link.itemKey === 'about')) && (
              <Dropdown
                trigger='click'
                position='bottomRight'
                render={
                  <Dropdown.Menu>
                    {supportNavLinks
                      .filter((link) => isMobile || link.itemKey !== 'docs')
                      .map((link) => (
                        <Dropdown.Item key={link.itemKey}>
                          {link.isExternal ? (
                            <a
                              href={link.externalLink}
                              target='_blank'
                              rel='noopener noreferrer'
                            >
                              {link.text}
                            </a>
                          ) : (
                            <Link to={link.to}>{link.text}</Link>
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
            )}
          </div>
        )}
      </SkeletonWrapper>
    </nav>
  );
};

export default Navigation;
