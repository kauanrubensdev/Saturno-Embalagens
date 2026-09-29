import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useCart } from '@/hooks/useCart';
import { CartBadge } from './CartBadge';

interface HeaderProps {
  showNav?: boolean;
}

export function Header({ showNav = false }: HeaderProps) {
  const { authReady, user, profile, isAdmin } = useAuth();
  const { theme, toggleTheme, setTheme, mounted } = useTheme();
  const { getTotalItems } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const totalItems = getTotalItems();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle Escape key and click outside
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Close mobile menu if window resizes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className="sticky top-0 z-50 w-full max-w-full box-border border-b"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {/* Top Navbar Row */}
      <div className="max-w-7xl mx-auto px-3 min-[376px]:px-4 sm:px-6 h-[60px] md:h-[68px] flex items-center justify-between gap-2">
        {/* Logo */}
        <Link
          to="/"
          onClick={closeMenu}
          className="flex items-center gap-2 sm:gap-2.5 no-underline group flex-shrink-0 max-w-[55%] min-[360px]:max-w-[45%] md:max-w-none"
        >
          <img
            src="/favicon.png"
            alt="Saturno Embalagens"
            className="w-7 h-7 min-[360px]:w-8 min-[360px]:h-8 md:w-10 md:h-10 object-contain transition-transform group-hover:scale-105 flex-shrink-0"
          />
          <span
            className="font-bold text-sm min-[360px]:text-base md:text-lg tracking-tight truncate"
            style={{ color: 'var(--foreground)' }}
          >
            <span style={{ color: 'var(--primary)' }}>Saturno</span>
            <span className="hidden min-[420px]:inline ml-1">Embalagens</span>
          </span>
        </Link>

        {/* Desktop Navigation Links (>= 768px) */}
        {showNav && (
          <div className="hidden md:flex items-center gap-2 mr-auto ml-2">
            <div
              className="w-px h-6 mx-1"
              style={{ backgroundColor: 'var(--border)' }}
            />
            <nav className="flex items-center gap-2">
              <Link
                to="/catalog"
                className="px-4 py-2 text-sm font-medium rounded-lg no-underline transition-all duration-150"
                style={{ color: 'var(--foreground)' }}
                activeProps={{
                  style: { color: 'var(--primary)', backgroundColor: 'var(--accent)' },
                }}
              >
                Catálogo
              </Link>
              <a
                href="https://wa.me/5531994838720?text=Ol%C3%A1!%20Gostaria%20de%20fazer%20uma%20arte%20personalizada%20para%20minhas%20embalagens."
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Solicitar arte personalizada pelo WhatsApp"
                title="Solicitar arte personalizada pelo WhatsApp"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl no-underline transition-all duration-150 hover:opacity-85 hover:scale-[1.02] flex-shrink-0"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  style={{ color: '#25D366' }}
                >
                  <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.275-.1-.476-.15-.676.15-.2.301-.777.978-.952 1.179-.176.2-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.895-.799-1.5-1.786-1.676-2.087-.175-.301-.019-.464.132-.614.136-.135.301-.351.451-.527.15-.175.2-.301.301-.501.101-.2.05-.376-.025-.526-.075-.15-.676-1.63-.927-2.232-.244-.587-.492-.507-.676-.516-.175-.009-.376-.01-.577-.01-.2 0-.526.075-.802.376-.275.301-1.052 1.028-1.052 2.508 0 1.48 1.077 2.908 1.228 3.109.15.2 2.12 3.237 5.136 4.54.717.31 1.277.496 1.713.634.72.229 1.375.197 1.893.12.578-.087 1.78-.727 2.03-1.43.25-.702.25-1.304.175-1.43-.075-.125-.275-.201-.576-.351zM12.04 2C6.516 2 2.028 6.488 2.028 12.012c0 1.942.556 3.755 1.521 5.289L2 22.04l4.873-1.503a9.97 9.97 0 005.167 1.475h.004c5.524 0 10.012-4.488 10.012-10.012A10.01 10.01 0 0012.04 2zm0 18.318c-1.69 0-3.345-.45-4.792-1.304l-.343-.204-2.887.89.907-2.813-.223-.356A8.28 8.28 0 013.73 12.012c0-4.582 3.728-8.31 8.31-8.31 2.22 0 4.308.865 5.878 2.435a8.264 8.264 0 012.434 5.875c0 4.583-3.728 8.31-8.312 8.31z" />
                </svg>
                <span>
                  Arte personalizada
                </span>
              </a>
            </nav>
          </div>
        )}

        {/* Desktop Right Side Controls (>= 768px) */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          {/* Theme Toggle */}
          {mounted && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              title={theme === 'dark' ? 'Tema escuro ativo' : 'Tema claro ativo'}
              aria-pressed={theme === 'dark'}
              className="p-2 rounded-xl transition-all duration-150 hover:scale-105 focus:outline-none focus-visible:ring-2"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-foreground)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          )}

          {/* Cart Badge with live count */}
          <CartBadge />

          {/* Auth */}
          {!authReady ? (
            <div
              className="h-9 w-20 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--muted)' }}
            />
          ) : user ? (
            <Link
              to={isAdmin ? '/admin' : '/account'}
              className="text-sm font-semibold px-4 py-2 rounded-xl no-underline transition-all duration-150 hover:opacity-90"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              {isAdmin ? 'ADMIN' : (profile?.name ? profile.name.split(' ')[0] : 'Conta')}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium px-4 py-2 rounded-xl no-underline transition-all duration-150 hover:opacity-80"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                Entrar
              </Link>
              <Link
                to="/register"
                className="inline-flex text-sm font-semibold px-4 py-2 rounded-xl no-underline transition-all duration-150 hover:opacity-90"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }}
              >
                Cadastrar
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button (< 768px) */}
        <div className="flex md:hidden items-center flex-shrink-0">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl flex items-center justify-center transition-all duration-150 hover:opacity-90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
            }}
          >
            {mobileMenuOpen ? (
              /* Close (X) Icon */
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              /* Hamburger (☰) Icon */
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Panel (< 768px) */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          ref={menuRef}
          className="md:hidden border-t w-full transition-all duration-200"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div className="px-3 min-[376px]:px-4 py-4 flex flex-col gap-2 max-w-full">
            {/* 1. Catálogo */}
            <Link
              to="/catalog"
              onClick={closeMenu}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium no-underline transition-all duration-150"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
              activeProps={{
                style: {
                  color: 'var(--primary)',
                  borderColor: 'var(--primary)',
                  fontWeight: 600,
                },
              }}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Catálogo de Produtos</span>
              </div>
              <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* 2. Arte personalizada */}
            <a
              href="https://wa.me/5531994838720?text=Ol%C3%A1!%20Gostaria%20de%20fazer%20uma%20arte%20personalizada%20para%20minhas%20embalagens."
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium no-underline transition-all duration-150"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  style={{ color: '#25D366' }}
                >
                  <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.275-.1-.476-.15-.676.15-.2.301-.777.978-.952 1.179-.176.2-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.895-.799-1.5-1.786-1.676-2.087-.175-.301-.019-.464.132-.614.136-.135.301-.351.451-.527.15-.175.2-.301.301-.501.101-.2.05-.376-.025-.526-.075-.15-.676-1.63-.927-2.232-.244-.587-.492-.507-.676-.516-.175-.009-.376-.01-.577-.01-.2 0-.526.075-.802.376-.275.301-1.052 1.028-1.052 2.508 0 1.48 1.077 2.908 1.228 3.109.15.2 2.12 3.237 5.136 4.54.717.31 1.277.496 1.713.634.72.229 1.375.197 1.893.12.578-.087 1.78-.727 2.03-1.43.25-.702.25-1.304.175-1.43-.075-.125-.275-.201-.576-.351zM12.04 2C6.516 2 2.028 6.488 2.028 12.012c0 1.942.556 3.755 1.521 5.289L2 22.04l4.873-1.503a9.97 9.97 0 005.167 1.475h.004c5.524 0 10.012-4.488 10.012-10.012A10.01 10.01 0 0012.04 2zm0 18.318c-1.69 0-3.345-.45-4.792-1.304l-.343-.204-2.887.89.907-2.813-.223-.356A8.28 8.28 0 013.73 12.012c0-4.582 3.728-8.31 8.31-8.31 2.22 0 4.308.865 5.878 2.435a8.264 8.264 0 012.434 5.875c0 4.583-3.728 8.31-8.312 8.31z" />
                </svg>
                <span>Arte personalizada</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(37, 211, 102, 0.15)', color: '#25D366' }}>
                WhatsApp
              </span>
            </a>

            {/* 3. Carrinho */}
            <Link
              to="/cart"
              onClick={closeMenu}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium no-underline transition-all duration-150"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
              activeProps={{
                style: {
                  color: 'var(--primary)',
                  borderColor: 'var(--primary)',
                  fontWeight: 600,
                },
              }}
            >
              <div className="flex items-center gap-2.5">
                <svg
                  className="w-4 h-4 text-[var(--foreground)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span>Carrinho</span>
              </div>
              {totalItems > 0 && (
                <span
                  className="min-w-[20px] h-[20px] px-1.5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </Link>

            <div className="h-px w-full my-1" style={{ backgroundColor: 'var(--border)' }} />

            {/* 4. Minha Conta & Admin */}
            {!authReady ? (
              <div
                className="h-10 w-full rounded-xl animate-pulse"
                style={{ backgroundColor: 'var(--muted)' }}
              />
            ) : user ? (
              <div className="flex flex-col gap-2">
                <Link
                  to="/account"
                  onClick={closeMenu}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium no-underline transition-all duration-150"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--foreground)',
                    border: '1px solid var(--border)',
                  }}
                  activeProps={{
                    style: {
                      color: 'var(--primary)',
                      borderColor: 'var(--primary)',
                      fontWeight: 600,
                    },
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-[var(--foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Minha Conta ({profile?.name ? profile.name.split(' ')[0] : 'Usuário'})</span>
                  </div>
                  <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={closeMenu}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold no-underline transition-all duration-150"
                    style={{
                      backgroundColor: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Painel Administrativo</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/20">
                      Admin
                    </span>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="flex items-center justify-center px-3 py-2 rounded-xl text-sm font-medium no-underline transition-all duration-150"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-foreground)',
                    border: '1px solid var(--border)',
                  }}
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  onClick={closeMenu}
                  className="flex items-center justify-center px-3 py-2 rounded-xl text-sm font-semibold no-underline transition-all duration-150"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  Cadastrar
                </Link>
              </div>
            )}

            <div className="h-px w-full my-1" style={{ backgroundColor: 'var(--border)' }} />

            {/* 5. Tema Dark / Light */}
            {mounted && (
              <div
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-center gap-2.5">
                  {theme === 'dark' ? (
                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                  <span>Aparência ({theme === 'dark' ? 'Tema Escuro' : 'Tema Claro'})</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    aria-label="Mudar para tema claro"
                    className={`px-2 py-1 text-xs rounded-lg font-medium transition-all ${
                      theme === 'light'
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    Claro
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    aria-label="Mudar para tema escuro"
                    className={`px-2 py-1 text-xs rounded-lg font-medium transition-all ${
                      theme === 'dark'
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    Escuro
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
