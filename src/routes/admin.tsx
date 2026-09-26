import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.authReady) {
      return;
    }
    if (!context.auth?.user) {
      throw redirect({ to: '/login' });
    }
    if (!context.auth?.profile || context.auth.profile.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  component: AdminLayoutRoute,
});

function AdminLayoutRoute() {
  const { authReady, user, profile, isAdmin } = useAuth();

  // Enquanto a autenticação estiver sendo restaurada ou se o usuário não for admin,
  // exibe uma tela limpa de carregamento para evitar flash visual da interface admin.
  if (!authReady || !user || !profile || !isAdmin) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center p-4"
        style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <svg
              className="w-6 h-6 text-white animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Carregando painel...
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

