import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  Check,
  Ban,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ShoppingBag,
  RotateCcw,
  Calendar,
  Eye,
  RefreshCw,
} from 'lucide-react';

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

// ─── Status definitions ───────────────────────────────────────────────────────

interface StatusConfig {
  value: OrderStatus;
  label: string;
  icon: typeof Clock;
  bg: string;
  text: string;
  border: string;
}

const NORMAL_STATUS_FLOW: StatusConfig[] = [
  { value: 'pending',   label: 'Pendente',   icon: Clock,        bg: 'rgba(251,191,36,0.12)', text: '#d97706', border: 'rgba(251,191,36,0.3)' },
  { value: 'confirmed', label: 'Confirmado', icon: CheckCircle2, bg: 'rgba(59,130,246,0.12)', text: '#2563eb', border: 'rgba(59,130,246,0.3)' },
  { value: 'preparing', label: 'Em preparo', icon: Package,      bg: 'rgba(139,92,246,0.12)', text: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
  { value: 'shipped',   label: 'Enviado',    icon: Truck,        bg: 'rgba(234,88,12,0.12)',  text: '#ea580c', border: 'rgba(234,88,12,0.3)'  },
  { value: 'delivered', label: 'Entregue',   icon: Check,        bg: 'rgba(22,163,74,0.12)',  text: '#16a34a', border: 'rgba(22,163,74,0.3)'  },
];

const CANCELLED_STATUS_CONFIG: StatusConfig = {
  value: 'cancelled',
  label: 'Cancelado',
  icon: Ban,
  bg: 'rgba(220,38,38,0.12)',
  text: '#dc2626',
  border: 'rgba(220,38,38,0.3)',
};

const ALL_STATUS_CONFIGS: Record<OrderStatus, StatusConfig> = {
  pending: NORMAL_STATUS_FLOW[0],
  confirmed: NORMAL_STATUS_FLOW[1],
  preparing: NORMAL_STATUS_FLOW[2],
  shipped: NORMAL_STATUS_FLOW[3],
  delivered: NORMAL_STATUS_FLOW[4],
  cancelled: CANCELLED_STATUS_CONFIG,
};

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

  // cancellation confirmation modal
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelItems, setCancelItems] = useState<OrderItem[]>([]);
  const [loadingCancelItems, setLoadingCancelItems] = useState(false);

  // status update in flight (tracks order ID being updated)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

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
    setSelectedOrder({ ...order, order_items: undefined });
    setLoadingDetail(true);

    try {
      const { data, error: itemsError } = await supabase
        .from('order_items')
        .select('id, product_id, product_name, product_price, quantity, total_price')
        .eq('order_id', order.id)
        .order('product_name', { ascending: true });

      if (itemsError) throw itemsError;
      setSelectedOrder({ ...order, order_items: (data as OrderItem[]) || [] });
    } catch (err) {
      console.error('[ADMIN-ORDERS] fetchItems error:', err);
      toast.error('Erro ao carregar itens do pedido.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Open cancel confirmation modal ───────────────────────────────────────
  const openCancelModal = async (order: Order) => {
    setOrderToCancel(order);
    setIsCancelModalOpen(true);
    setCancelItems(order.order_items || []);

    // If order items not loaded yet, fetch them for the modal preview
    if (!order.order_items || order.order_items.length === 0) {
      try {
        setLoadingCancelItems(true);
        const { data } = await supabase
          .from('order_items')
          .select('id, product_id, product_name, product_price, quantity, total_price')
          .eq('order_id', order.id);

        setCancelItems((data as OrderItem[]) || []);
      } catch (err) {
        console.warn('[ADMIN-ORDERS] Erro ao carregar itens para cancelamento:', err);
      } finally {
        setLoadingCancelItems(false);
      }
    }
  };

  // ── Update order status via RPC ──────────────────────────────────────────
  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingOrderId(orderId);

      // Call secure RPC
      const { data, error: rpcError } = await supabase.rpc('admin_update_order_status', {
        p_order_id: orderId,
        p_new_status: newStatus,
      });

      if (rpcError) throw rpcError;

      const res = data as { success?: boolean; message?: string; restocked?: boolean; total_units?: number } | null;
      const successMessage = res?.message || 'Status do pedido atualizado com sucesso!';

      toast.success(successMessage);

      // Optimistic state update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );

      // Update detail modal if open
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
      }

      // Close cancel modal if it was open
      if (isCancelModalOpen && orderToCancel?.id === orderId) {
        setIsCancelModalOpen(false);
        setOrderToCancel(null);
      }
    } catch (err: any) {
      console.error('[ADMIN-ORDERS] handleStatusUpdate error:', err);
      toast.error(err.message || 'Erro ao atualizar status do pedido.');
    } finally {
      setUpdatingOrderId(null);
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
              Gestão de Pedidos
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Acompanhe, atualize e gerencie os pedidos da loja com controle de estoque automático.
            </p>
          </div>
          <button
            onClick={fetchOrders}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 cursor-pointer"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por cliente ou ID do pedido..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="all">Todos os status</option>
            {NORMAL_STATUS_FLOW.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
            <option value="cancelled">Cancelado</option>
          </select>

          {/* Period Filter */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="w-full sm:w-44 px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2"
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
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-destructive" />
            <p className="font-medium mb-2" style={{ color: 'var(--foreground)' }}>{error}</p>
            <button
              onClick={fetchOrders}
              className="text-sm font-medium hover:underline cursor-pointer"
              style={{ color: 'var(--primary)' }}
            >
              Tentar novamente
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            className="p-12 rounded-xl text-center"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <ShoppingBag className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              {orders.length === 0 ? 'Nenhum pedido encontrado' : 'Nenhum pedido corresponde aos filtros'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {orders.length === 0
                ? 'Quando seus clientes realizarem pedidos eles aparecerão aqui.'
                : 'Tente ajustar os filtros ou os termos de busca.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Totals summary bar ── */}
            <div className="text-xs text-muted-foreground">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'pedido' : 'pedidos'} encontrado{filteredOrders.length !== 1 ? 's' : ''}{' '}
              · Total: <strong style={{ color: 'var(--foreground)' }}>{formatCurrency(filteredOrders.reduce((s, o) => s + o.total, 0))}</strong>
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden lg:block overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--muted)' }}>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left text-muted-foreground">Pedido</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left text-muted-foreground">Cliente</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left text-muted-foreground">Data</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left text-muted-foreground">Entrega</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left text-muted-foreground">Total</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left text-muted-foreground min-w-[220px]">Alterar Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: 'var(--card)' }}>
                  {filteredOrders.map((order, idx) => {
                    const isUpdating = updatingOrderId === order.id;
                    const isCancelled = order.status === 'cancelled';
                    const currentCfg = ALL_STATUS_CONFIGS[order.status] || ALL_STATUS_CONFIGS.pending;
                    const StatusIcon = currentCfg.icon;

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-muted/20 transition-colors"
                        style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}
                      >
                        {/* ID */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                            {shortId(order.id)}
                          </span>
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                              {order.profile?.name ?? '—'}
                            </p>
                            {order.profile?.phone && (
                              <p className="text-xs text-muted-foreground">{order.profile.phone}</p>
                            )}
                          </div>
                        </td>

                        {/* Data */}
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(order.created_at)}
                          </span>
                        </td>

                        {/* Tipo de entrega */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {order.delivery_type === 'delivery' ? (
                              <Truck className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <Package className="w-3.5 h-3.5 text-primary" />
                            )}
                            <span>{DELIVERY_TYPE_LABELS[order.delivery_type]}</span>
                          </div>
                        </td>

                        {/* Total */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                            {formatCurrency(order.total)}
                          </span>
                        </td>

                        {/* Status visual control */}
                        <td className="px-4 py-3">
                          {isCancelled ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={{
                                  backgroundColor: CANCELLED_STATUS_CONFIG.bg,
                                  color: CANCELLED_STATUS_CONFIG.text,
                                  border: `1px solid ${CANCELLED_STATUS_CONFIG.border}`,
                                }}
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Cancelado
                              </span>
                              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                Estoque devolvido
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* Status progression select */}
                              <div className="relative">
                                <select
                                  disabled={isUpdating}
                                  value={order.status}
                                  onChange={(e) => {
                                    const nextStatus = e.target.value as OrderStatus;
                                    if (nextStatus === 'cancelled') {
                                      openCancelModal(order);
                                    } else {
                                      handleStatusUpdate(order.id, nextStatus);
                                    }
                                  }}
                                  className="appearance-none pl-8 pr-7 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2"
                                  style={{
                                    backgroundColor: currentCfg.bg,
                                    color: currentCfg.text,
                                    borderColor: currentCfg.border,
                                  }}
                                >
                                  {NORMAL_STATUS_FLOW.map((s) => (
                                    <option key={s.value} value={s.value} style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)' }}>
                                      {s.label}
                                    </option>
                                  ))}
                                  <option value="cancelled" style={{ backgroundColor: 'var(--card)', color: 'var(--destructive)' }}>
                                    ⚠️ Cancelar pedido
                                  </option>
                                </select>
                                <StatusIcon
                                  className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                  style={{ color: currentCfg.text }}
                                />
                                {isUpdating ? (
                                  <Loader2
                                    className="w-3.5 h-3.5 animate-spin absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                                    style={{ color: currentCfg.text }}
                                  />
                                ) : (
                                  <ChevronDown
                                    className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                                    style={{ color: currentCfg.text }}
                                  />
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openDetail(order)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80 cursor-pointer"
                              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                              title="Ver detalhes do pedido"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Detalhes
                            </button>

                            {!isCancelled && (
                              <button
                                onClick={() => openCancelModal(order)}
                                disabled={isUpdating}
                                className="p-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-destructive/10 text-destructive cursor-pointer disabled:opacity-50"
                                title="Cancelar pedido e devolver estoque"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile/Tablet cards ── */}
            <div className="lg:hidden space-y-3">
              {filteredOrders.map((order) => {
                const isUpdating = updatingOrderId === order.id;
                const isCancelled = order.status === 'cancelled';
                const currentCfg = ALL_STATUS_CONFIGS[order.status] || ALL_STATUS_CONFIGS.pending;
                const StatusIcon = currentCfg.icon;

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl p-4 border space-y-3"
                    style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                          {shortId(order.id)}
                        </span>
                        <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--foreground)' }}>
                          {order.profile?.name ?? '—'}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {formatDate(order.created_at)}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-primary block">
                          {formatCurrency(order.total)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {DELIVERY_TYPE_LABELS[order.delivery_type]}
                        </span>
                      </div>
                    </div>

                    {/* Status Changer Bar */}
                    <div className="pt-2 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
                      {isCancelled ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
                            style={{
                              backgroundColor: CANCELLED_STATUS_CONFIG.bg,
                              color: CANCELLED_STATUS_CONFIG.text,
                              border: `1px solid ${CANCELLED_STATUS_CONFIG.border}`,
                            }}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Cancelado
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Estoque devolvido
                          </span>
                        </div>
                      ) : (
                        <div className="relative flex-1">
                          <select
                            disabled={isUpdating}
                            value={order.status}
                            onChange={(e) => {
                              const nextStatus = e.target.value as OrderStatus;
                              if (nextStatus === 'cancelled') {
                                openCancelModal(order);
                              } else {
                                handleStatusUpdate(order.id, nextStatus);
                              }
                            }}
                            className="w-full appearance-none pl-8 pr-7 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-all disabled:opacity-50"
                            style={{
                              backgroundColor: currentCfg.bg,
                              color: currentCfg.text,
                              borderColor: currentCfg.border,
                            }}
                          >
                            {NORMAL_STATUS_FLOW.map((s) => (
                              <option key={s.value} value={s.value} style={{ backgroundColor: 'var(--card)', color: 'var(--foreground)' }}>
                                Status: {s.label}
                              </option>
                            ))}
                            <option value="cancelled" style={{ backgroundColor: 'var(--card)', color: 'var(--destructive)' }}>
                              ⚠️ Cancelar pedido
                            </option>
                          </select>
                          <StatusIcon
                            className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            style={{ color: currentCfg.text }}
                          />
                          {isUpdating ? (
                            <Loader2
                              className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                              style={{ color: currentCfg.text }}
                            />
                          ) : (
                            <ChevronDown
                              className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                              style={{ color: currentCfg.text }}
                            />
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openDetail(order)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80 cursor-pointer"
                          style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                        >
                          Detalhes
                        </button>
                        {!isCancelled && (
                          <button
                            onClick={() => openCancelModal(order)}
                            className="p-1.5 rounded-lg text-xs font-medium transition-colors text-destructive hover:bg-destructive/10"
                            title="Cancelar pedido"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── CANCELLATION CONFIRMATION MODAL ── */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent
          className="sm:max-w-md"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(220, 38, 38, 0.12)', color: 'var(--destructive)' }}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                  Confirmar Cancelamento do Pedido
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Pedido {orderToCancel ? shortId(orderToCancel.id) : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Warning callout */}
            <div
              className="p-3.5 rounded-xl border text-xs leading-relaxed space-y-1"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                borderColor: 'rgba(220, 38, 38, 0.2)',
                color: 'var(--destructive)',
              }}
            >
              <p className="font-semibold flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                Devolução automática de estoque
              </p>
              <p className="opacity-90">
                Ao cancelar este pedido, todos os itens comprados serão devolvidos ao estoque dos produtos
                e as movimentações de entrada serão registradas atomicamente.
              </p>
            </div>

            {/* Order info summary */}
            {orderToCancel && (
              <div className="p-3.5 rounded-xl bg-muted/60 border text-xs space-y-2" style={{ borderColor: 'var(--border)' }}>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                    {orderToCancel.profile?.name ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total do pedido:</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(orderToCancel.total)}
                  </span>
                </div>

                {/* Items preview to be restored */}
                <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                    Itens que retornarão ao estoque:
                  </p>
                  {loadingCancelItems ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>Carregando itens...</span>
                    </div>
                  ) : cancelItems.length > 0 ? (
                    <div className="space-y-1">
                      {cancelItems.map((item) => (
                        <div key={item.id} className="flex justify-between text-muted-foreground">
                          <span className="truncate pr-2">• {item.product_name}</span>
                          <span className="font-medium text-success whitespace-nowrap">
                            +{item.quantity} un.
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">Itens vinculados a este pedido.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => {
                setIsCancelModalOpen(false);
                setOrderToCancel(null);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors hover:bg-muted cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={updatingOrderId !== null}
              onClick={() => {
                if (orderToCancel) {
                  handleStatusUpdate(orderToCancel.id, 'cancelled');
                }
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              style={{ backgroundColor: 'var(--destructive)' }}
            >
              {updatingOrderId !== null ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Cancelando e devolvendo estoque...</span>
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>Confirmar cancelamento</span>
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DETAIL MODAL ── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent
          className="sm:max-w-2xl max-h-[92vh] overflow-y-auto"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                Detalhes do Pedido {selectedOrder ? shortId(selectedOrder.id) : ''}
              </DialogTitle>
            </div>
          </DialogHeader>

          {!selectedOrder ? null : loadingDetail ? (
            <div className="space-y-3 py-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              <p className="text-xs text-muted-foreground">Carregando detalhes do pedido...</p>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {/* Status Progression Workflow */}
              <div
                className="p-4 rounded-2xl border space-y-3"
                style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Fluxo do Pedido
                  </p>
                  {selectedOrder.status === 'cancelled' && (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ backgroundColor: CANCELLED_STATUS_CONFIG.bg, color: CANCELLED_STATUS_CONFIG.text }}
                    >
                      <Ban className="w-3 h-3" />
                      Cancelado (Estoque Devolvido)
                    </span>
                  )}
                </div>

                {/* Progression steps */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {NORMAL_STATUS_FLOW.map((s) => {
                    const isActive = selectedOrder.status === s.value;
                    const Icon = s.icon;
                    const isUpdating = updatingOrderId === selectedOrder.id;

                    return (
                      <button
                        key={s.value}
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusUpdate(selectedOrder.id, s.value)}
                        className={`p-2.5 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                          isActive
                            ? 'ring-2 shadow-sm'
                            : 'hover:opacity-80 opacity-75 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: isActive ? s.bg : 'var(--card)',
                          color: isActive ? s.text : 'var(--muted-foreground)',
                          borderColor: isActive ? s.text : 'var(--border)',
                        }}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[11px] whitespace-nowrap">{s.label}</span>
                        {isActive && <span className="text-[10px] font-bold">✓ Atual</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Separate Cancel Button */}
                {selectedOrder.status !== 'cancelled' ? (
                  <div className="pt-2 flex justify-end border-t" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => openCancelModal(selectedOrder)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancelar pedido e devolver estoque
                    </button>
                  </div>
                ) : (
                  <div
                    className="p-2.5 rounded-xl text-xs flex items-center gap-2"
                    style={{ backgroundColor: 'rgba(220, 38, 38, 0.08)', color: 'var(--destructive)' }}
                  >
                    <RotateCcw className="w-4 h-4 flex-shrink-0" />
                    <span>Este pedido foi cancelado e os itens retornaram ao estoque.</span>
                  </div>
                )}
              </div>

              {/* Customer info */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Informações do Cliente
                </h3>
                <div className="p-3.5 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Nome:</span>
                    <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                      {selectedOrder.profile?.name ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Telefone:</span>
                    <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                      {selectedOrder.profile?.phone ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Data de criação:</span>
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {formatDate(selectedOrder.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Forma de Pagamento:</span>
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {selectedOrder.payment_method ? PAYMENT_METHOD_LABELS[selectedOrder.payment_method] : 'Dinheiro na entrega'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Delivery info */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Entrega / Recebimento
                </h3>
                <div className="p-3.5 rounded-xl border text-xs space-y-1.5" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    {selectedOrder.delivery_type === 'delivery' ? (
                      <Truck className="w-4 h-4 text-primary" />
                    ) : (
                      <Package className="w-4 h-4 text-primary" />
                    )}
                    <span className="font-bold" style={{ color: 'var(--foreground)' }}>
                      {DELIVERY_TYPE_LABELS[selectedOrder.delivery_type]}
                    </span>
                  </div>

                  {selectedOrder.delivery_type === 'delivery' && selectedOrder.shipping_address ? (
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedOrder.shipping_address.street}, nº {selectedOrder.shipping_address.number}
                      {selectedOrder.shipping_address.complement && ` (${selectedOrder.shipping_address.complement})`}
                      <br />
                      {selectedOrder.shipping_address.neighborhood} — {selectedOrder.shipping_address.city}/{selectedOrder.shipping_address.state}
                      <br />
                      CEP: {selectedOrder.shipping_address.zip_code}
                    </p>
                  ) : (
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedOrder.pickup_address || 'R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG'}
                    </p>
                  )}
                </div>
              </section>

              {/* Order items */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Itens do Pedido ({selectedOrder.order_items?.length || 0})
                </h3>
                {selectedOrder.order_items && selectedOrder.order_items.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--muted)' }}>
                          <th className="px-3 py-2 text-left font-semibold uppercase text-muted-foreground">Produto</th>
                          <th className="px-3 py-2 text-center font-semibold uppercase text-muted-foreground">Qtd</th>
                          <th className="px-3 py-2 text-right font-semibold uppercase text-muted-foreground">Unit.</th>
                          <th className="px-3 py-2 text-right font-semibold uppercase text-muted-foreground">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody style={{ backgroundColor: 'var(--card)' }}>
                        {selectedOrder.order_items.map((item, idx) => (
                          <tr key={item.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                            <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--foreground)' }}>
                              {item.product_name}
                            </td>
                            <td className="px-3 py-2.5 text-center text-muted-foreground font-semibold">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">
                              {formatCurrency(item.product_price)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold" style={{ color: 'var(--foreground)' }}>
                              {formatCurrency(item.total_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhum item encontrado.</p>
                )}
              </section>

              {/* Totals Breakdown */}
              <section className="p-3.5 rounded-xl border space-y-1.5 text-xs" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Frete:</span>
                  <span className="text-success font-medium">
                    {selectedOrder.shipping_cost > 0 ? formatCurrency(selectedOrder.shipping_cost) : 'Grátis'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t font-bold text-sm" style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                  <span>Total:</span>
                  <span className="text-primary text-base font-black">{formatCurrency(selectedOrder.total)}</span>
                </div>
              </section>

              {/* Customer note */}
              {selectedOrder.customer_note && (
                <section className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Observações do Cliente</h3>
                  <p className="text-xs p-3 rounded-xl border bg-muted/40 text-muted-foreground" style={{ borderColor: 'var(--border)' }}>
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
