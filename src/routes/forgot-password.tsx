import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await forgotPassword(email);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: var(--background) }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ backgroundColor: var(--primary) }}>
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: var(--foreground) }}>Recuperar senha</h1>
          <p className="mt-1 text-sm" style={{ color: var(--muted-foreground) }}>Enviaremos um link para redefinir sua senha</p>
        </div>

        <div className="rounded-2xl shadow-lg p-8" style={{ backgroundColor: var(--card), border: '1px solid var(--border)' }}>
          {success ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: var(--muted) }}>
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: var(--foreground) }}>E-mail enviado!</h3>
              <p className="text-sm mb-6" style={{ color: var(--muted-foreground) }}>
                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg py-2.5 px-6 text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: var(--primary) }}
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: var(--muted), color: var(--destructive), border: '1px solid var(--destructive)' }}>
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: var(--foreground) }}>
                  E-mail cadastrado
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2"
                  style={{ borderColor: var(--border), backgroundColor: var(--card), color: var(--foreground) }}
                  onFocus={(e) => { e.target.style.borderColor = '#FF6B00'; e.target.style.boxShadow = '0 0 0 3px rgba(255,107,0,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: var(--primary) }}
              >
                {loading ? 'Enviando...' : 'Enviar link'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm mt-6" style={{ color: var(--muted-foreground) }}>
          Lembrou a senha?{' '}
          <Link to="/login" className="font-semibold transition-colors hover:underline" style={{ color: var(--primary) }}>
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
