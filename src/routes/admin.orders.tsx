import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ─── Domain types ────────────────────────────────────────────────────────────

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
type PaymentMethod = 'pix' | 'credit_card' | 'cash_on_delivery' | null;
type DeliveryType = 'delivery' | 'pickup';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  total_price: number;
}

interface Address {
  id: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

interface CustomerProfile {
  id: string;
  name: string;
  phone: string | null;
}

interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  shipping_cost: number;
  total: number;
  delivery_type: DeliveryType;
  shipping_address_id: string | null;
  pickup_address: string | null;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
  // joined
  profile?: CustomerProfile | null;
  shipping_address?: Address | null;
  order_items?: OrderItem[];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'pending',   label: 'Pendente'    },
  { value: 'confirmed', label: 'Confirmado'  },
  { value: 'preparing', label: 'Em preparo'  },
  { value: 'shipped',   label: 'Enviado'     },
  { value: 'delivered', label: 'Entregue'    },
  { value: 'cancelled', label: 'Cancelado'   },
];

const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: 'pending',  label: 'Aguardando'  },
  { value: 'paid',     label: 'Pago'        },
  { value: 'failed',   label: 'Falhou'      },
  { value: 'refunded', label: 'Reembolsado' },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  cash_on_delivery: 'Dinheiro na Entrega',
};

const DELIVERY_TYPE_LABELS: Record<string, string> = {
  delivery: 'Entrega',
  pickup: 'Retirada',
};

function statusColor(status: OrderStatus): { bg: string; text: string } {
  switch (status) {
    case 'pending':   return { bg: 'rgba(251,191,36,0.12)', text: '#d97706' };
    case 'confirmed': return { bg: 'rgba(59,130,246,0.12)', text: '#2563eb' };
    case 'preparing': return { bg: 'rgba(139,92,246,0.12)', text: '#7c3aed' };
    case 'shipped':   return { bg: 'rgba(234,88,12,0.12)',  text: '#ea580c' };
    case 'delivered': return { bg: 'rgba(22,163,74,0.12)',  text: 'var(--success)' };
    case 'cancelled': return { bg: 'rgba(220,38,38,0.12)',  text: 'var(--destructive)' };
  }
}

function paymentStatusColor(status: PaymentStatus): { bg: string; text: string } {
  switch (status) {
    case 'pending':  return { bg: 'rgba(251,191,36,0.12)', text: '#d97706' };
    case 'paid':     return { bg: 'rgba(22,163,74,0.12)',  text: 'var(--success)' };
    case 'failed':   return { bg: 'rgba(220,38,38,0.12)',  text: 'var(--destructive)' };
    case 'refunded': return { bg: 'rgba(139,92,246,0.12)', text: '#7c3aed' };
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/admin/orders')({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.authReady) return;
    if (!context.auth?.user) throw redirect({ to: '/login' });
    if (!context.auth?.profile || context.auth.profile.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  component: AdminOrdersPage,
});

// ─── Component ───────────────────────────────────────────────────────────────

function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');

  // detail modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // status update
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  // ── Fetch all orders with joined profile + shipping_address ─────────────
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id, user_id, status, payment_status, payment_method,
          subtotal, shipping_cost, total,
          delivery_type, shipping_address_id, pickup_address,
          customer_note, created_at, updated_at,
          profile:profiles!orders_user_id_fkey ( id, name, phone ),
          shipping_address:addresses!orders_shipping_address_id_fkey (
            id, street, number, complement, neighborhood, city, state, zip_code
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setOrders((data as unknown as Order[]) || []);
    } catch (err) {
      console.error('[ADMIN-ORDERS] fetchOrders error:', err);
      setError('Erro ao carregar pedidos. Verifique se a policy RLS de admin está ativa.');
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch order items for the detail modal ───────────────────────────────
  const openDetail = async (order: Order) => {
    setIsDetailOpen(true);
    // Start with what we already have (no items yet)
    setSelectedOrder({ ...order, order_items: undefined });
    setLoadingDetail(true);

    const { data, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, product_name, product_price, quantity, total_price')
      .eq('order_id', order.id)
      .order('product_name', { ascending: true });

    if (itemsError) {
      console.error('[ADMIN-ORDERS] fetchItems error:', itemsError);
      toast.error('Erro ao carregar itens do pedido.');
    }
    setSelectedOrder({ ...order, order_items: (data as OrderItem[]) || [] });
    setLoadingDetail(false);
  };

  // ── Update order status ──────────────────────────────────────────────────
  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingStatus(true);
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (updateError) throw updateError;

      toast.success('Status do pedido atualizado!');
      // optimistic update in list
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      // update detail if open
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : prev);
      }
    } catch (err) {
      console.error('[ADMIN-ORDERS] updateStatus error:', err);
      toast.error('Erro ao atualizar status. Verifique a policy RLS "Admin atualiza pedidos".');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Filtered list ────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter((order) => {
      // status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

      // period filter
      if (periodFilter !== 'all') {
        const orderDate = new Date(order.created_at);
        const diffMs = now.getTime() - orderDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (periodFilter === '7d' && diffDays > 7) return false;
        if (periodFilter === '30d' && diffDays > 30) return false;
        if (periodFilter === '90d' && diffDays > 90) return false;
      }

      // search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(q);
        const matchesName = order.profile?.name?.toLowerCase().includes(q) ?? false;
        if (!matchesId && !matchesName) return false;
      }

      return true;
    });
  }, [orders, statusFilter, periodFilter, searchQuery]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              Pedidos
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Gerencie e acompanhe os pedidos da loja.
            </p>
          </div>
          <button
            onClick={fetchOrders}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 cursor-pointer"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--muted-foreground)' }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por cliente ou ID do pedido..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="all">Todos os status</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Period */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="w-full sm:w-44 px-3 py-2.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="all">Todo período</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
          </select>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--muted)' }} />
            ))}
          </div>
        ) : error ? (
          <div
            className="p-6 rounded-xl text-center"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <svg className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--destructive)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="font-medium mb-2" style={{ color: 'var(--foreground)' }}>{error}</p>
            <button onClick={fetchOrders} className="text-sm font-medium hover:underline cursor-pointer" style={{ color: 'var(--primary)' }}>
              Tentar novamente
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            className="p-12 rounded-xl text-center"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--muted)' }}>
              <svg className="w-8 h-8" style={{ color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              {orders.length === 0 ? 'Nenhum pedido encontrado' : 'Nenhum pedido corresponde aos filtros'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {orders.length === 0
                ? 'Quando seus clientes realizarem pedidos eles aparecerão aqui.'
                : 'Tente ajustar os filtros ou os termos de busca.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Totals summary bar ── */}
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'} encontrado{filteredOrders.length !== 1 ? 's' : ''}{' '}
              · Total: <strong style={{ color: 'var(--foreground)' }}>{formatCurrency(filteredOrders.reduce((s, o) => s + o.total, 0))}</strong>
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden md:block overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--muted)' }}>
                    {['Pedido', 'Cliente', 'Data', 'Entrega', 'Pagamento', 'Total', 'Status', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${i >= 6 ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: 'var(--card)' }}>
                  {filteredOrders.map((order, idx) => {
                    const sc = statusColor(order.status);
                    return (
                      <tr key={order.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                        {/* ID */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                            {shortId(order.id)}
                          </span>
                        </td>
                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                            {order.profile?.name ?? '—'}
                          </span>
                        </td>
                        {/* Data */}
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {formatDate(order.created_at)}
                          </span>
                        </td>
                        {/* Tipo de entrega */}
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {DELIVERY_TYPE_LABELS[order.delivery_type]}
                          </span>
                        </td>
                        {/* Pagamento */}
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {order.payment_method ? PAYMENT_METHOD_LABELS[order.payment_method] : '—'}
                          </span>
                        </td>
                        {/* Total */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                            {formatCurrency(order.total)}
                          </span>
                        </td>
                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: sc.bg, color: sc.text }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.text }} />
                            {ORDER_STATUSES.find((s) => s.value === order.status)?.label}
                          </span>
                        </td>
                        {/* Action */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openDetail(order)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80 cursor-pointer"
                            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((order) => {
                const sc = statusColor(order.status);
                return (
                  <div
                    key={order.id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-mono text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                          {shortId(order.id)}
                        </p>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--foreground)' }}>
                          {order.profile?.name ?? '—'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0"
                        style={{ backgroundColor: sc.bg, color: sc.text }}
                      >
                        {ORDER_STATUSES.find((s) => s.value === order.status)?.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t gap-2" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {formatCurrency(order.total)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {DELIVERY_TYPE_LABELS[order.delivery_type]}
                        </span>
                      </div>
                      <button
                        onClick={() => openDetail(order)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80 cursor-pointer"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                      >
                        Detalhes
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent
          className="sm:max-w-2xl max-h-[92vh] overflow-y-auto"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>
              Pedido {selectedOrder ? shortId(selectedOrder.id) : ''}
            </DialogTitle>
          </DialogHeader>

          {!selectedOrder ? null : loadingDetail ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--muted)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-5 py-2">

              {/* Status update */}
              <div
                className="p-4 rounded-xl"
                style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Alterar status do pedido
                </p>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUSES.map((s) => {
                    const isActive = selectedOrder.status === s.value;
                    const sc = statusColor(s.value as OrderStatus);
                    return (
                      <button
                        key={s.value}
                        disabled={updatingStatus || isActive}
                        onClick={() => handleStatusUpdate(selectedOrder.id, s.value as OrderStatus)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: isActive ? sc.bg : 'var(--card)',
                          color: isActive ? sc.text : 'var(--muted-foreground)',
                          border: `1px solid ${isActive ? sc.text : 'var(--border)'}`,
                          opacity: updatingStatus && !isActive ? 0.5 : 1,
                        }}
                      >
                        {s.label}
                        {isActive && ' ✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer info */}
              <section>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                  Cliente
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  <span>Nome:</span>
                  <span style={{ color: 'var(--foreground)' }}>{selectedOrder.profile?.name ?? '—'}</span>
                  <span>Telefone:</span>
                  <span style={{ color: 'var(--foreground)' }}>{selectedOrder.profile?.phone ?? '—'}</span>
                  <span>Data/hora:</span>
                  <span style={{ color: 'var(--foreground)' }}>{formatDate(selectedOrder.created_at)}</span>
                </div>
              </section>

              {/* Delivery info */}
              <section>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                  Entrega
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  <span>Tipo:</span>
                  <span style={{ color: 'var(--foreground)' }}>{DELIVERY_TYPE_LABELS[selectedOrder.delivery_type]}</span>
                  <span>Pagamento:</span>
                  <span style={{ color: 'var(--foreground)' }}>
                    {selectedOrder.payment_method ? PAYMENT_METHOD_LABELS[selectedOrder.payment_method] : '—'}
                  </span>
                  <span>Status pagamento:</span>
                  <span>
                    {(() => {
                      const psc = paymentStatusColor(selectedOrder.payment_status);
                      return (
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: psc.bg, color: psc.text }}
                        >
                          {PAYMENT_STATUSES.find((p) => p.value === selectedOrder.payment_status)?.label}
                        </span>
                      );
                    })()}
                  </span>
                </div>

                {/* Shipping address */}
                {selectedOrder.delivery_type === 'delivery' && selectedOrder.shipping_address && (
                  <div className="mt-2 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--muted)' }}>
                    <p style={{ color: 'var(--foreground)' }}>
                      {selectedOrder.shipping_address.street}, {selectedOrder.shipping_address.number}
                      {selectedOrder.shipping_address.complement && `, ${selectedOrder.shipping_address.complement}`}
                    </p>
                    <p style={{ color: 'var(--muted-foreground)' }}>
                      {selectedOrder.shipping_address.neighborhood} · {selectedOrder.shipping_address.city}/{selectedOrder.shipping_address.state}
                    </p>
                    <p style={{ color: 'var(--muted-foreground)' }}>CEP: {selectedOrder.shipping_address.zip_code}</p>
                  </div>
                )}

                {/* Pickup address */}
                {selectedOrder.delivery_type === 'pickup' && selectedOrder.pickup_address && (
                  <div className="mt-2 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--muted)' }}>
                    <p style={{ color: 'var(--foreground)' }}>{selectedOrder.pickup_address}</p>
                  </div>
                )}
              </section>

              {/* Order items */}
              <section>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                  Itens do pedido
                </h3>
                {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                  <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--muted)' }}>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Produto</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Qtd</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Unit.</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody style={{ backgroundColor: 'var(--card)' }}>
                        {selectedOrder.order_items.map((item, idx) => (
                          <tr key={item.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                            <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{item.product_name}</td>
                            <td className="px-3 py-2 text-center" style={{ color: 'var(--muted-foreground)' }}>{item.quantity}</td>
                            <td className="px-3 py-2 text-right" style={{ color: 'var(--muted-foreground)' }}>{formatCurrency(item.product_price)}</td>
                            <td className="px-3 py-2 text-right font-medium" style={{ color: 'var(--foreground)' }}>{formatCurrency(item.total_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Nenhum item encontrado.</p>
                )}
              </section>

              {/* Totals */}
              <section>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                  Valores
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--muted-foreground)' }}>Subtotal dos itens:</span>
                    <span style={{ color: 'var(--foreground)' }}>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--muted-foreground)' }}>Frete:</span>
                    <span style={{ color: 'var(--foreground)' }}>
                      {selectedOrder.shipping_cost > 0 ? formatCurrency(selectedOrder.shipping_cost) : 'Grátis'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--foreground)' }}>Total:</span>
                    <span style={{ color: 'var(--primary)' }}>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>
              </section>

              {/* Customer note */}
              {selectedOrder.customer_note && (
                <section>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Observações do cliente</h3>
                  <p
                    className="text-sm p-3 rounded-lg"
                    style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
                  >
                    {selectedOrder.customer_note}
                  </p>
                </section>
              )}

            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
