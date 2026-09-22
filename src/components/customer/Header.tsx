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
      <div className="max-w-7xl mx-auto px-4 h-[68px] flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 no-underline group flex-shrink-0"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <svg
              className="w-5 h-5 text-white"
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
            className="font-bold text-lg tracking-tight"
            style={{ color: 'var(--foreground)' }}
          >
            <span style={{ color: 'var(--primary)' }}>Saturno</span>Embalagens
          </span>
        </Link>

        {/* Navigation */}
        {showNav && (
          <>
            <div
              className="hidden md:block w-px h-6 mx-2"
              style={{ backgroundColor: 'var(--border)' }}
            />
            <nav className="hidden md:flex items-center gap-1">
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
            </nav>
          </>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
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

          {/* Auth — usa authReady para não mostrar estado incorreto */}
          {!authReady ? (
            <div
              className="h-9 w-20 rounded-xl animate-pulse"
              style={{ backgroundColor: 'var(--muted)' }}
            />
          ) : user ? (
            // Autenticado - admin vê link para /admin, customer vê link para /account
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
            // Deslogado
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
                className="text-sm font-semibold px-4 py-2 rounded-xl no-underline transition-all duration-150 hover:opacity-90"
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
