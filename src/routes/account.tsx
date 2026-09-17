import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Route = createFileRoute('/account')({
  beforeLoad: async ({ context }) => {
    console.info('[AUTH-11] beforeLoad /account iniciado');
    const { user } = context as { user?: { id: string } | null };
    console.info('[AUTH-12] context.user', user ?? null);
    const { data, error } = await supabase.auth.getSession();
    console.info('[AUTH-13] sessão atual', {
      session: Boolean(data.session),
      user: data.session?.user.id ?? null,
      error: error?.message ?? null,
    });
    if (!user) {
      throw redirect({ to: '/login' });
    }
    return { user };
  },
  component: AccountPage,
});

function AccountPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await updateProfile({ name, phone });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Perfil atualizado com sucesso!');
        await refreshProfile();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>
          Minha Conta
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--card)',
                color: 'var(--foreground)',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
              Telefone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="w-full h-11 px-4 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--card)',
                color: 'var(--foreground)',
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
              E-mail
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full h-11 px-4 rounded-xl border text-sm cursor-not-allowed"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--muted)',
                color: 'var(--muted-foreground)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full h-11 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </div>
    </div>
  );
}
