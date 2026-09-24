import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Header } from '@/components/customer/Header';
import {
  User,
  ShoppingBag,
  Clock,
  Truck,
  Building2,
  Banknote,
  ChevronRight,
  Package,
  Loader2,
  Calendar,
} from 'lucide-react';

export const Route = createFileRoute('/account')({
  beforeLoad: async ({ context }) => {
    // Aguarda autenticação estar pronta — não trata loading como "não logado"
    if (!context.auth?.authReady) {
      return; // deixa o componente decidir (ele mostra loading)
    }
    if (!context.auth?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: AccountPage,
});

interface CustomerOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  total_price: number;
}

interface CustomerOrder {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  delivery_type: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  pickup_address: string | null;
  customer_note: string | null;
  created_at: string;
  shipping_address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip_code: string;
  } | null;
  order_items?: CustomerOrderItem[];
}

const ORDER_STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pendente', bg: 'rgba(251,191,36,0.12)', text: '#d97706' },
  confirmed: { label: 'Confirmado', bg: 'rgba(59,130,246,0.12)', text: '#2563eb' },
  preparing: { label: 'Em preparo', bg: 'rgba(139,92,246,0.12)', text: '#7c3aed' },
  shipped: { label: 'Enviado', bg: 'rgba(234,88,12,0.12)', text: '#ea580c' },
  delivered: { label: 'Entregue', bg: 'rgba(22,163,74,0.12)', text: 'var(--success)' },
  cancelled: { label: 'Cancelado', bg: 'rgba(220,38,38,0.12)', text: 'var(--destructive)' },
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function AccountPage() {
  const { authReady, user, profile, refreshProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'orders'>('profile');

  // Profile form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Popular profile
  useEffect(() => {
    if (authReady && profile) {
      setName(profile.name || '');
      setPhone(profile.phone || '');
    }
  }, [authReady, profile]);

  // Carregar pedidos do cliente
  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      try {
        setLoadingOrders(true);
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id, user_id, status, payment_status, payment_method,
            subtotal, shipping_cost, total, delivery_type,
            pickup_address, customer_note, created_at,
            shipping_address:addresses!orders_shipping_address_id_fkey (
              street, number, neighborhood, city, state, zip_code
            ),
            order_items (
              id, product_id, product_name, product_price, quantity, total_price
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setOrders((data as unknown as CustomerOrder[]) || []);
      } catch (err) {
        console.error('[ACCOUNT] Erro ao carregar pedidos:', err);
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchOrders();
  }, [user]);

  // Loading state enquanto auth não está pronto
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="animate-pulse text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Carregando...
        </div>
      </div>
    );
  }

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
    } catch (err) {
      console.error('[ACCOUNT-ERROR]', err);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <Header showNav />

      <main className="flex-1 py-8 sm:py-10">
        <div className="max-w-3xl mx-auto px-4 w-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                Minha Conta
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Olá, {profile?.name || user?.email}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs sm:text-sm font-medium px-4 py-2 rounded-xl transition-all hover:opacity-80 cursor-pointer"
              style={{
                backgroundColor: 'var(--muted)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
              }}
            >
              Sair
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b mb-6 pb-2" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{
                backgroundColor: activeTab === 'profile' ? 'var(--primary)' : 'transparent',
              }}
            >
              <User className="w-4 h-4" />
              <span>Dados Pessoais</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'orders'
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{
                backgroundColor: activeTab === 'orders' ? 'var(--primary)' : 'transparent',
              }}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Meus Pedidos</span>
              {orders.length > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.2 rounded-full"
                  style={{
                    backgroundColor: activeTab === 'orders' ? 'rgba(255,255,255,0.25)' : 'var(--muted)',
                    color: activeTab === 'orders' ? '#fff' : 'var(--foreground)',
                  }}
                >
                  {orders.length}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: DADOS PESSOAIS */}
          {activeTab === 'profile' && (
            <div
              className="rounded-2xl p-6 border"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h2 className="text-base font-bold mb-4" style={{ color: 'var(--foreground)' }}>
                Informações de Perfil
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
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
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>
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
                      backgroundColor: 'var(--background)',
                      color: 'var(--foreground)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-muted-foreground">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full h-11 px-4 rounded-xl border text-sm cursor-not-allowed opacity-80"
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
                  className="w-full h-11 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: MEUS PEDIDOS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {loadingOrders ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  Carregando seus pedidos...
                </div>
              ) : orders.length === 0 ? (
                <div
                  className="rounded-2xl p-8 border text-center space-y-4"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                    style={{ backgroundColor: 'var(--muted)' }}
                  >
                    <ShoppingBag className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                      Você ainda não fez nenhum pedido
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Explore nosso catálogo e faça sua primeira compra.
                    </p>
                  </div>
                  <Link
                    to="/catalog"
                    className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl font-semibold text-white text-xs transition-all hover:opacity-90"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    Ver Catálogo
                  </Link>
                </div>
              ) : (
                orders.map((ord) => {
                  const statusInfo =
                    ORDER_STATUS_LABELS[ord.status] || {
                      label: ord.status,
                      bg: 'var(--muted)',
                      text: 'var(--foreground)',
                    };
                  const isExpanded = expandedOrderId === ord.id;

                  return (
                    <div
                      key={ord.id}
                      className="rounded-2xl border transition-all overflow-hidden"
                      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                    >
                      {/* Order summary header */}
                      <div
                        onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                              #{ord.id.slice(0, 8).toUpperCase()}
                            </span>
                            <span
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
                            >
                              {statusInfo.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(ord.created_at)}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              {ord.delivery_type === 'delivery' ? (
                                <Truck className="w-3.5 h-3.5" />
                              ) : (
                                <Building2 className="w-3.5 h-3.5" />
                              )}
                              {ord.delivery_type === 'delivery' ? 'Entrega' : 'Retirada'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground block">Total</span>
                            <span className="font-bold text-sm text-primary">
                              {formatCurrency(ord.total)}
                            </span>
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 text-muted-foreground transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expanded order details */}
                      {isExpanded && (
                        <div
                          className="p-4 sm:p-5 border-t space-y-4 text-xs sm:text-sm"
                          style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--background)',
                          }}
                        >
                          {/* Items */}
                          <div>
                            <h4 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                              Itens do Pedido
                            </h4>
                            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                              {(ord.order_items || []).map((item) => (
                                <div
                                  key={item.id}
                                  className="py-2 flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                                      {item.product_name}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {item.quantity} un. × {formatCurrency(item.product_price)}
                                    </p>
                                  </div>
                                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                                    {formatCurrency(item.total_price)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Reception & Payment */}
                          <div
                            className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <div className="p-3 rounded-xl bg-card border" style={{ borderColor: 'var(--border)' }}>
                              <p className="font-semibold text-xs mb-1" style={{ color: 'var(--foreground)' }}>
                                {ord.delivery_type === 'delivery' ? 'Endereço de Entrega' : 'Local de Retirada'}
                              </p>
                              {ord.delivery_type === 'delivery' && ord.shipping_address ? (
                                <p className="text-xs text-muted-foreground">
                                  {ord.shipping_address.street}, {ord.shipping_address.number}
                                  <br />
                                  {ord.shipping_address.neighborhood} — {ord.shipping_address.city}/{ord.shipping_address.state}
                                  <br />
                                  CEP: {ord.shipping_address.zip_code}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  {ord.pickup_address || 'R. Urupema, nº 150 - Santa Luzia/MG'}
                                </p>
                              )}
                            </div>

                            <div className="p-3 rounded-xl bg-card border" style={{ borderColor: 'var(--border)' }}>
                              <p className="font-semibold text-xs mb-1" style={{ color: 'var(--foreground)' }}>
                                Pagamento
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Dinheiro na entrega
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                Frete: Grátis (R$ 0,00)
                              </p>
                            </div>
                          </div>

                          {ord.customer_note && (
                            <div className="p-3 rounded-xl bg-card border text-xs" style={{ borderColor: 'var(--border)' }}>
                              <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Observações: </span>
                              <span className="text-muted-foreground">{ord.customer_note}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>

      <footer
        className="border-t mt-12"
        style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-8 text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 Saturno Embalagens. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
