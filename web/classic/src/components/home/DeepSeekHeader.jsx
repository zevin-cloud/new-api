import React, { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useHeaderBar } from '../../hooks/common/useHeaderBar';
import { useNavigation } from '../../hooks/common/useNavigation';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';

export default function DeepSeekHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);

  const {
    currentLang,
    systemName,
    logo,
    docsLink,
    headerNavModules,
    pricingRequireAuth,
    handleLanguageChange,
    t,
  } = useHeaderBar({
    onMobileMenuToggle: () => setMobileMenuOpen((prev) => !prev),
    drawerOpen: mobileMenuOpen,
  });

  const { mainNavLinks } = useNavigation(
    t,
    docsLink,
    headerNavModules,
    userState?.user,
  );

  const isEn = currentLang?.startsWith('en');
  const systemLogo = statusState?.status?.logo || logo || '/new-api-icon.png';
  const systemVersion = statusState?.status?.version || 'API Gateway';

  return (
    <header className='ds-header-wrapper'>
      <div className='ds-header-bar'>
        {/* Left Group: Logo + System Name + Badge + Nav Links */}
        <div className='flex items-center gap-6 lg:gap-8 min-w-0'>
          <Link
            className='flex items-center gap-[10px] min-w-0 text-white group shrink-0'
            to='/'
          >
            {/* Logo */}
            <img
              src={systemLogo}
              alt='logo'
              className='h-[28px] w-[28px] rounded-lg object-contain shrink-0 shadow-md shadow-blue-500/20'
            />

            {/* System Name */}
            <span className='font-ds-sans font-semibold text-[17px] tracking-tight text-white'>
              {systemName}
            </span>

            {/* Glass Pill Badge */}
            <span className='inline-flex items-center gap-[5px] min-w-0'>
              <span
                className='inline-flex items-center rounded-[8px] p-[1px]'
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.08) 35%, rgba(255,255,255,0.04) 65%, rgba(255,255,255,0.4) 100%)',
                  boxShadow:
                    '0 0 16px rgba(255,255,255,0.08), 0 0 32px rgba(255,255,255,0.04)',
                }}
              >
                <span className='min-w-0 truncate pt-[3px] pb-[3px] rounded-[7px] font-mono text-[10px] font-medium leading-none px-[8px] bg-black/30 text-white/90'>
                  {systemVersion}
                </span>
              </span>
            </span>
          </Link>

          {/* Desktop Navigation: Positioned on the LEFT, next to logo/badge */}
          <nav className='hidden md:flex items-center gap-6 text-[14px]'>
            {mainNavLinks.map((link) => {
              if (link.isExternal) {
                return (
                  <a
                    key={link.itemKey}
                    href={link.externalLink}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-white/75 hover:text-white transition-colors duration-200 font-normal'
                  >
                    {link.text}
                  </a>
                );
              }
              let targetPath = link.to;
              if (link.itemKey === 'console' && !userState?.user) {
                targetPath = '/login';
              }
              if (
                link.itemKey === 'pricing' &&
                pricingRequireAuth &&
                !userState?.user
              ) {
                targetPath = '/login';
              }
              const isActive = location.pathname === targetPath;
              return (
                <Link
                  key={link.itemKey}
                  to={targetPath}
                  className={
                    isActive
                      ? 'text-white font-medium transition-colors'
                      : 'text-white/75 hover:text-white transition-colors duration-200 font-normal'
                  }
                >
                  {link.text}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Group: Locale Toggle + User/Login Button */}
        <div className='hidden md:flex items-center gap-4 shrink-0'>
          {/* Language Toggle */}
          <div className='ds-locale-toggle'>
            <button
              type='button'
              onClick={() => handleLanguageChange('zh')}
              className={`ds-locale-toggle-item ${currentLang === 'zh' ? 'is-active' : ''}`}
            >
              中文
            </button>
            <button
              type='button'
              onClick={() => handleLanguageChange('en')}
              className={`ds-locale-toggle-item ${currentLang === 'en' ? 'is-active' : ''}`}
            >
              EN
            </button>
          </div>

          {/* Login / User Action */}
          {userState?.user ? (
            <Link
              to='/console'
              className='ds-btn-primary !h-[34px] !py-0 !px-4 text-[13px] font-medium'
            >
              {userState.user.username || (isEn ? 'Console' : '控制台')}
            </Link>
          ) : (
            <Link
              to='/login'
              className='ds-btn-primary !h-[34px] !py-0 !px-4 text-[13px] font-medium'
            >
              {isEn ? 'Sign In' : '登录 / 注册'}
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className='md:hidden flex items-center justify-center w-10 h-10 text-white/80 hover:text-white'
          aria-label='Toggle navigation menu'
        >
          {mobileMenuOpen ? (
            <svg width='24' height='24' viewBox='0 0 24 24' fill='none'>
              <path
                d='M6 6l12 12M6 18L18 6'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
              />
            </svg>
          ) : (
            <svg width='24' height='24' viewBox='0 0 24 24' fill='none'>
              <path
                d='M3 6h18M3 12h18M3 18h18'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className='md:hidden mt-2 p-4 rounded-2xl bg-[#0b101b]/95 backdrop-blur-2xl border border-white/10 flex flex-col gap-3'>
          {mainNavLinks.map((link) => {
            if (link.isExternal) {
              return (
                <a
                  key={link.itemKey}
                  href={link.externalLink}
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={() => setMobileMenuOpen(false)}
                  className='text-sm font-medium text-white/80 hover:text-white py-1'
                >
                  {link.text}
                </a>
              );
            }
            let targetPath = link.to;
            if (link.itemKey === 'console' && !userState?.user) {
              targetPath = '/login';
            }
            if (
              link.itemKey === 'pricing' &&
              pricingRequireAuth &&
              !userState?.user
            ) {
              targetPath = '/login';
            }
            return (
              <Link
                key={link.itemKey}
                to={targetPath}
                onClick={() => setMobileMenuOpen(false)}
                className='text-sm font-medium text-white/80 hover:text-white py-1'
              >
                {link.text}
              </Link>
            );
          })}
          <div className='pt-2 border-t border-white/10 flex items-center justify-between'>
            <span className='text-xs text-white/60'>Language</span>
            <div className='ds-locale-toggle'>
              <button
                type='button'
                onClick={() => handleLanguageChange('zh')}
                className={`ds-locale-toggle-item ${currentLang === 'zh' ? 'is-active' : ''}`}
              >
                中文
              </button>
              <button
                type='button'
                onClick={() => handleLanguageChange('en')}
                className={`ds-locale-toggle-item ${currentLang === 'en' ? 'is-active' : ''}`}
              >
                EN
              </button>
            </div>
          </div>
          <Link
            to={userState?.user ? '/console' : '/login'}
            onClick={() => setMobileMenuOpen(false)}
            className='ds-btn-primary !h-[36px] justify-center mt-1'
          >
            <span>
              {userState?.user
                ? userState.user.username || (isEn ? 'Console' : '控制台')
                : isEn
                  ? 'Sign In / Register'
                  : '登录 / 注册'}
            </span>
          </Link>
        </div>
      )}
    </header>
  );
}
