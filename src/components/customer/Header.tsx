import { Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { CartBadge } from './CartBadge';

interface HeaderProps {
  showNav?: boolean;
}

export function Header({ showNav = false }: HeaderProps) {
  const { user, profile } = useAuth();

  return (
    <header
      className="sticky top-0 z-50 w-full border-b shadow-sm"
      style={{ backgroundColor: '#ffffff', borderColor: '#e5e5e5' }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 no-underline">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#FF6B00' }}
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
          <span className="font-bold text-lg" style={{ color: '#1a1a1a' }}>
            SaturnoEmbalagens
          </span>
        </Link>

        {/* Navigation */}
        {showNav && (
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/catalog"
              className="text-sm font-medium no-underline transition-colors hover:opacity-70"
              style={{ color: '#1a1a1a' }}
            >
              Catálogo
            </Link>
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          <CartBadge />
          {user ? (
            <Link
              to="/account"
              className="text-sm font-medium px-4 py-2 rounded-xl no-underline transition-all hover:opacity-90"
              style={{ backgroundColor: '#f5f5f5', color: '#1a1a1a' }}
            >
              {profile?.name ? profile.name.split(' ')[0] : 'Conta'}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium px-4 py-2 rounded-xl no-underline transition-all hover:opacity-90"
                style={{ backgroundColor: '#f5f5f5', color: '#1a1a1a' }}
              >
                Entrar
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium px-4 py-2 rounded-xl no-underline transition-all hover:opacity-90"
                style={{ backgroundColor: '#FF6B00', color: '#ffffff' }}
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
