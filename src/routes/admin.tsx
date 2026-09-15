import { createFileRoute, Link, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context }) => {
    const { user, profile } = context as {
      user?: { id: string } | null;
      profile?: { role: 'customer' | 'admin' } | null;
    };
    if (!user) {
      throw redirect({ to: '/login' });
    }
    if (profile?.role !== 'admin') {
      throw redirect({ to: '/account' });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fcfbf8' }}>
      <div className="text-center max-w-md mx-auto px-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: '#FF6B00' }}
        >
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#1a1a1a' }}>
          Área Administrativa
        </h1>
        <p className="text-sm mb-8" style={{ color: '#666666' }}>
          Esta área ainda está em desenvolvimento. Em breve você poderá gerenciar produtos, pedidos e muito mais.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white no-underline transition-all hover:opacity-90"
          style={{ backgroundColor: '#FF6B00' }}
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
