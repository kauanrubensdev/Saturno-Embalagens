import { Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { CartBadge } from './CartBadge';

interface HeaderProps {
  showNav?: boolean;
}

export function Header({ showNav = false }: HeaderProps) {
  const { authReady, user, profile, isAdmin } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <header
      className="sticky top-0 z-50 w-full border-b"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-[60px] sm:h-[68px] flex items-center justify-between gap-2 sm:gap-4">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 sm:gap-2.5 no-underline group flex-shrink-0"
        >
          <div
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 flex-shrink-0"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <span
            className="font-bold text-base sm:text-lg tracking-tight"
            style={{ color: 'var(--foreground)' }}
          >
            <span style={{ color: 'var(--primary)' }}>Saturno</span>
            <span className="hidden min-[400px]:inline">Embalagens</span>
          </span>
        </Link>

        {/* Navigation */}
        {showNav && (
          <div className="flex items-center gap-1 sm:gap-2 mr-auto ml-1 sm:ml-2">
            <div
              className="hidden md:block w-px h-6 mx-1"
              style={{ backgroundColor: 'var(--border)' }}
            />
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/catalog"
                className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg no-underline transition-all duration-150"
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
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-xl no-underline transition-all duration-150 hover:opacity-85 hover:scale-[1.02] flex-shrink-0"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-foreground)',
                  border: '1px solid var(--border)',
                }}
              >
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  style={{ color: '#25D366' }}
                >
                  <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.978-.275-.1-.476-.15-.676.15-.2.301-.777.978-.952 1.179-.176.2-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.895-.799-1.5-1.786-1.676-2.087-.175-.301-.019-.464.132-.614.136-.135.301-.351.451-.527.15-.175.2-.301.301-.501.101-.2.05-.376-.025-.526-.075-.15-.676-1.63-.927-2.232-.244-.587-.492-.507-.676-.516-.175-.009-.376-.01-.577-.01-.2 0-.526.075-.802.376-.275.301-1.052 1.028-1.052 2.508 0 1.48 1.077 2.908 1.228 3.109.15.2 2.12 3.237 5.136 4.54.717.31 1.277.496 1.713.634.72.229 1.375.197 1.893.12.578-.087 1.78-.727 2.03-1.43.25-.702.25-1.304.175-1.43-.075-.125-.275-.201-.576-.351zM12.04 2C6.516 2 2.028 6.488 2.028 12.012c0 1.942.556 3.755 1.521 5.289L2 22.04l4.873-1.503a9.97 9.97 0 005.167 1.475h.004c5.524 0 10.012-4.488 10.012-10.012A10.01 10.01 0 0012.04 2zm0 18.318c-1.69 0-3.345-.45-4.792-1.304l-.343-.204-2.887.89.907-2.813-.223-.356A8.28 8.28 0 013.73 12.012c0-4.582 3.728-8.31 8.31-8.31 2.22 0 4.308.865 5.878 2.435a8.264 8.264 0 012.434 5.875c0 4.583-3.728 8.31-8.312 8.31z" />
                </svg>
                <span>
                  Arte<span className="hidden sm:inline"> personalizada</span>
                </span>
              </a>
            </nav>
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Theme Toggle */}
          {mounted && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              title={theme === 'dark' ? 'Tema escuro ativo' : 'Tema claro ativo'}
              aria-pressed={theme === 'dark'}
              className="p-1.5 sm:p-2 rounded-xl transition-all duration-150 hover:scale-105 focus:outline-none focus-visible:ring-2"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-foreground)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {theme === 'dark' ? (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          )}

          {/* Cart Badge with live count */}
          <CartBadge />

          {/* Auth — usa authReady para não mostrar estado incorreto */}
          {!authReady ? (
            <div
              className="h-8 sm:h-9 w-16 sm:w-20 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--muted)' }}
            />
          ) : user ? (
            // Autenticado - admin vê link para /admin, customer vê link para /account
            <Link
              to={isAdmin ? '/admin' : '/account'}
              className="text-xs sm:text-sm font-semibold px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl no-underline transition-all duration-150 hover:opacity-90"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              {isAdmin ? 'ADMIN' : (profile?.name ? profile.name.split(' ')[0] : 'Conta')}
            </Link>
          ) : (
            // Deslogado
            <>
              <Link
                to="/login"
                className="text-xs sm:text-sm font-medium px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl no-underline transition-all duration-150 hover:opacity-80"
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
                className="hidden sm:inline-flex text-sm font-semibold px-4 py-2 rounded-xl no-underline transition-all duration-150 hover:opacity-90"
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
      </div>
    </header>
  );
}
