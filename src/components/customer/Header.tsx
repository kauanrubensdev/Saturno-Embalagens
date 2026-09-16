import { Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { CartBadge } from './CartBadge';

interface HeaderProps {
  showNav?: boolean;
}

export function Header({ showNav = false }: HeaderProps) {
  const { user, profile } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <header
      className="sticky top-0 z-50 w-full border-b shadow-sm"
      style={{
        backgroundColor: theme === 'dark' ? '#001621' : '#F5F5DC',
        borderColor: theme === 'dark' ? 'rgba(255,65,3,0.15)' : '#E8D9BB',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 no-underline">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: theme === 'dark' ? '#FF4103' : '#FE5516' }}
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
            className="font-bold text-lg"
            style={{ color: theme === 'dark' ? '#F5F5DC' : '#001621' }}
          >
            SaturnoEmbalagens
          </span>
        </Link>

        {/* Navigation */}
        {showNav && (
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/catalog"
              className="text-sm font-medium no-underline transition-colors hover:opacity-70"
              style={{ color: theme === 'dark' ? '#F5F5DC' : '#001621' }}
            >
              Catálogo
            </Link>
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="p-2 rounded-lg transition-all hover:opacity-80"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#E8D9BB',
                color: theme === 'dark' ? '#F5F5DC' : '#001621',
                border: 'none',
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

          <CartBadge />
          {user ? (
            <Link
              to="/account"
              className="text-sm font-medium px-4 py-2 rounded-xl no-underline transition-all hover:opacity-90"
              style={{
                backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#E8D9BB',
                color: theme === 'dark' ? '#F5F5DC' : '#001621',
              }}
            >
              {profile?.name ? profile.name.split(' ')[0] : 'Conta'}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium px-4 py-2 rounded-xl no-underline transition-all hover:opacity-90"
                style={{
                  backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#E8D9BB',
                  color: theme === 'dark' ? '#F5F5DC' : '#001621',
                }}
              >
                Entrar
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium px-4 py-2 rounded-xl no-underline transition-all hover:opacity-90"
                style={{
                  backgroundColor: theme === 'dark' ? '#FF4103' : '#FE5516',
                  color: '#ffffff',
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
