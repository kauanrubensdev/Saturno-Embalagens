import { Link } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ShoppingBag,
  Package,
  Users,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Check,
  Truck,
  Building2,
  Calendar,
  ChevronRight,
  Plus,
  Layers,
  RefreshCw,
  AlertCircle,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';

// ── Status styling configs ───────────────────────────────────────────────────

const ORDER_STATUS_CONFIGS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending:   { label: 'Pendente',    bg: 'rgba(251,191,36,0.12)', text: '#d97706', border: 'rgba(251,191,36,0.3)' },
  confirmed: { label: 'Confirmado',  bg: 'rgba(59,130,246,0.12)', text: '#2563eb', border: 'rgba(59,130,246,0.3)' },
  preparing: { label: 'Em preparo',  bg: 'rgba(139,92,246,0.12)', text: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
  shipped:   { label: 'Enviado',     bg: 'rgba(234,88,12,0.12)',  text: '#ea580c', border: 'rgba(234,88,12,0.3)'  },
  delivered: { label: 'Entregue',    bg: 'rgba(22,163,74,0.12)',  text: '#16a34a', border: 'rgba(22,163,74,0.3)'  },
  cancelled: { label: 'Cancelado',   bg: 'rgba(220,38,38,0.12)',  text: '#dc2626', border: 'rgba(220,38,38,0.3)'  },
};

const PAYMENT_STATUS_CONFIGS: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending:   { label: 'Pendente',    bg: 'rgba(251,191,36,0.12)', text: '#d97706', border: 'rgba(251,191,36,0.3)' },
  paid:      { label: 'Pago',        bg: 'rgba(22,163,74,0.12)',  text: '#16a34a', border: 'rgba(22,163,74,0.3)'  },
  failed:    { label: 'Falhou',      bg: 'rgba(220,38,38,0.12)',  text: '#dc2626', border: 'rgba(220,38,38,0.3)'  },
  cancelled: { label: 'Cancelado',   bg: 'rgba(107,114,128,0.12)', text: '#6b7280', border: 'rgba(107,114,128,0.3)' },
  refunded:  { label: 'Reembolsado', bg: 'rgba(139,92,246,0.12)', text: '#7c3aed', border: 'rgba(139,92,246,0.3)' },
};

interface RecentOrder {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  total: number;
  delivery_type: string;
}

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  lowStockCount: number;
  totalCustomers: number;
}

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

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalProducts: 0,
    lowStockCount: 0,
    totalCustomers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [
        ordersCountRes,
        pendingOrdersCountRes,
        recentOrdersRes,
        productsCountRes,
        lowStockRes,
        customersCountRes,
      ] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase
          .from('orders')
          .select('id, created_at, status, payment_status, total, delivery_type')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('id, name, stock_quantity').lte('stock_quantity', 10),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
      ]);

      if (ordersCountRes.error) throw ordersCountRes.error;

      setStats({
        totalOrders: ordersCountRes.count ?? 0,
        pendingOrders: pendingOrdersCountRes.count ?? 0,
        totalProducts: productsCountRes.count ?? 0,
        lowStockCount: lowStockRes.data?.length ?? 0,
        totalCustomers: customersCountRes.count ?? 0,
      });

      setRecentOrders((recentOrdersRes.data as RecentOrder[]) || []);
    } catch (err: any) {
      console.error('[ADMIN-DASHBOARD] Erro ao carregar dados:', err);
      setError('Não foi possível carregar os dados do painel.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ── SKELETON LOADING STATE (Preserves layout & prevents CLS) ───────────────
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 w-64 rounded-xl bg-muted" />
            <div className="h-4 w-96 rounded bg-muted/60" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-muted/50" />
        </div>

        {/* 4 Stat Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="p-5 rounded-2xl border space-y-4"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-muted/70" />
                <div className="w-10 h-10 rounded-xl bg-muted" />
              </div>
              <div className="space-y-2">
                <div className="h-8 w-20 rounded bg-muted" />
                <div className="h-3.5 w-32 rounded bg-muted/50" />
              </div>
            </div>
          ))}
        </div>

        {/* 2-Column Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent Orders Skeleton (7 cols) */}
          <div
            className="lg:col-span-7 p-6 rounded-2xl border space-y-4"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="h-5 w-36 rounded bg-muted" />
              <div className="h-4 w-16 rounded bg-muted/60" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="p-3.5 rounded-xl border border-border bg-muted/30 flex justify-between items-center">
                  <div className="space-y-1.5">
                    <div className="h-4 w-28 rounded bg-muted" />
                    <div className="h-3 w-40 rounded bg-muted/60" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions & Stock Skeleton (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div
              className="p-6 rounded-2xl border space-y-4"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="h-5 w-32 rounded bg-muted" />
              <div className="space-y-2.5">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-14 rounded-xl border border-border bg-muted/30" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR STATE (In-page friendly retry) ───────────────────────────────────
  if (error) {
    return (
      <div
        className="p-8 sm:p-12 rounded-3xl border text-center max-w-lg mx-auto my-12 space-y-5 shadow-sm"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}
        >
          <AlertCircle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
            {error}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Verifique sua conexão com a internet ou as permissões de acesso e tente novamente.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchDashboardData(false)}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-white text-xs sm:text-sm transition-all hover:opacity-90 cursor-pointer shadow-sm mx-auto"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  // ── Stat Cards Definition ──────────────────────────────────────────────────
  const metricCards = [
    {
      title: 'Pedidos',
      value: stats.totalOrders,
      badge: stats.pendingOrders > 0 ? `${stats.pendingOrders} pendente(s)` : 'Em dia',
      badgeColor: stats.pendingOrders > 0 ? '#d97706' : '#16a34a',
      badgeBg: stats.pendingOrders > 0 ? 'rgba(251,191,36,0.12)' : 'rgba(22,163,74,0.12)',
      description: 'Gerencie pedidos e status de entrega',
      icon: <ShoppingBag className="w-5 h-5 text-primary" />,
      link: '/admin/orders',
    },
    {
      title: 'Produtos',
      value: stats.totalProducts,
      badge: 'Catálogo',
      badgeColor: 'var(--primary)',
      badgeBg: 'rgba(255,65,3,0.1)',
      description: 'Gerencie preços, fotos e descrições',
      icon: <Package className="w-5 h-5 text-primary" />,
      link: '/admin/products',
    },
    {
      title: 'Clientes',
      value: stats.totalCustomers,
      badge: 'Ativos',
      badgeColor: '#2563eb',
      badgeBg: 'rgba(59,130,246,0.12)',
      description: 'Visualização de cadastros e clientes',
      icon: <Users className="w-5 h-5 text-primary" />,
      link: '/admin/customers',
    },
    {
      title: 'Controle de Estoque',
      value: stats.lowStockCount,
      badge: stats.lowStockCount > 0 ? 'Estoque Baixo' : 'Normal',
      badgeColor: stats.lowStockCount > 0 ? '#dc2626' : '#16a34a',
      badgeBg: stats.lowStockCount > 0 ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)',
      description: stats.lowStockCount > 0 ? 'Itens com 10 ou menos unidades' : 'Níveis de estoque adequados',
      icon: <Boxes className="w-5 h-5 text-primary" />,
      link: '/admin/stock',
    },
  ];

  const quickActionsList = [
    {
      title: 'Adicionar produto',
      description: 'Cadastre um novo item ao catálogo',
      link: '/admin/products',
      icon: <Plus className="w-4 h-4" />,
    },
    {
      title: 'Gerenciar categorias',
      description: 'Organize departamentos e seções',
      link: '/admin/categories',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      title: 'Ver todos os pedidos',
      description: 'Acompanhe vendas e envie atualizações',
      link: '/admin/orders',
      icon: <ShoppingBag className="w-4 h-4" />,
    },
    {
      title: 'Controle de estoque',
      description: 'Realize entradas, saídas e ajustes',
      link: '/admin/stock',
      icon: <Boxes className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
              Dashboard Administrativo
            </h1>
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
              style={{
                backgroundColor: 'rgba(255,65,3,0.12)',
                color: 'var(--primary)',
              }}
            >
              Painel Geral
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Visão geral em tempo real da sua operação, pedidos e inventário.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchDashboardData(true)}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all hover:bg-muted cursor-pointer disabled:opacity-50 shadow-xs self-start sm:self-auto"
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'var(--card)',
            color: 'var(--foreground)',
          }}
          title="Atualizar dados do dashboard"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
          <span>{isRefreshing ? 'Atualizando...' : 'Atualizar dados'}</span>
        </button>
      </div>

      {/* ── 4 Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {metricCards.map((card) => (
          <Link
            key={card.title}
            to={card.link}
            className="group block p-5 sm:p-6 rounded-2xl border transition-all duration-200 hover:shadow-md hover:border-primary/50 no-underline relative"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {card.title}
              </span>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                style={{ backgroundColor: 'var(--muted)' }}
              >
                {card.icon}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--foreground)' }}>
                  {card.value}
                </span>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: card.badgeBg,
                    color: card.badgeColor,
                  }}
                >
                  {card.badge}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1 pt-1">
                {card.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs font-semibold text-primary group-hover:underline" style={{ borderColor: 'var(--border)' }}>
              <span>Acessar módulo</span>
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </Link>
        ))}
      </div>

      {/* ── Main Content Grid: Left (Orders) + Right (Actions & Alerts) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Left Column: Recent Orders (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div
            className="p-6 rounded-3xl border shadow-sm space-y-5"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary" />
                <h2 className="text-base sm:text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  Pedidos Recentes
                </h2>
              </div>
              <Link
                to="/admin/orders"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline no-underline"
              >
                <span>Ver todos os pedidos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div
                className="py-10 text-center space-y-3 rounded-2xl border border-dashed"
                style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
                  style={{ backgroundColor: 'var(--muted)' }}
                >
                  <ShoppingBag className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                    Nenhum pedido recente
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 max-w-xs mx-auto">
                    Assim que clientes realizarem compras no checkout, os pedidos aparecerão listados aqui.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((ord) => {
                  const statusInfo =
                    ORDER_STATUS_CONFIGS[ord.status] || {
                      label: ord.status,
                      bg: 'var(--muted)',
                      text: 'var(--foreground)',
                      border: 'var(--border)',
                    };
                  const paymentInfo =
                    PAYMENT_STATUS_CONFIGS[ord.payment_status] || PAYMENT_STATUS_CONFIGS.pending;

                  return (
                    <Link
                      key={ord.id}
                      to="/admin/orders"
                      className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:border-primary/40 hover:bg-muted/30 no-underline group"
                      style={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-xs sm:text-sm text-foreground">
                            #{ord.id.slice(0, 8).toUpperCase()}
                          </span>

                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: statusInfo.bg,
                              color: statusInfo.text,
                              border: `1px solid ${statusInfo.border}`,
                            }}
                          >
                            {statusInfo.label}
                          </span>

                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: paymentInfo.bg,
                              color: paymentInfo.text,
                              border: `1px solid ${paymentInfo.border}`,
                            }}
                          >
                            {paymentInfo.label}
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
                              <Truck className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                            )}
                            {ord.delivery_type === 'delivery' ? 'Entrega' : 'Retirada'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <span className="text-xs font-bold text-primary sm:text-sm block">
                            {formatCurrency(ord.total)}
                          </span>
                        </div>
                        <div className="p-1 rounded-lg text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Actions & Inventory Alert (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quick Actions Card */}
          <div
            className="p-6 rounded-3xl border shadow-sm space-y-4"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <Layers className="w-5 h-5 text-primary" />
              <h2 className="text-base sm:text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                Ações Rápidas
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {quickActionsList.map((action) => (
                <Link
                  key={action.title}
                  to={action.link}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all hover:border-primary/40 hover:bg-muted/40 no-underline group"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-xs transition-transform group-hover:scale-105"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {action.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {action.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* Stock Health / Low Stock Alert Card */}
          <div
            className="p-6 rounded-3xl border shadow-sm space-y-3"
            style={{
              backgroundColor: stats.lowStockCount > 0 ? 'rgba(220, 38, 38, 0.05)' : 'rgba(22, 163, 74, 0.05)',
              borderColor: stats.lowStockCount > 0 ? 'rgba(220, 38, 38, 0.25)' : 'rgba(22, 163, 74, 0.25)',
            }}
          >
            <div className="flex items-center gap-2.5">
              {stats.lowStockCount > 0 ? (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' }}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(22, 163, 74, 0.15)', color: '#16a34a' }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}

              <div>
                <h3
                  className="text-xs sm:text-sm font-bold"
                  style={{ color: stats.lowStockCount > 0 ? '#dc2626' : '#16a34a' }}
                >
                  {stats.lowStockCount > 0 ? 'Atenção ao Estoque' : 'Estoque em Dia'}
                </h3>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {stats.lowStockCount > 0 ? (
                <>
                  Existem <strong className="text-foreground">{stats.lowStockCount} produto(s)</strong> com estoque baixo (10 ou menos unidades). Verifique seu inventário para evitar rupturas de pedidos.
                </>
              ) : (
                <>
                  Todos os produtos ativos possuem estoque acima do limite mínimo recomendado.
                </>
              )}
            </p>

            <div className="pt-1">
              <Link
                to="/admin/stock"
                className="inline-flex items-center gap-1 text-xs font-semibold hover:underline no-underline"
                style={{ color: stats.lowStockCount > 0 ? '#dc2626' : '#16a34a' }}
              >
                <span>Acessar controle de estoque</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
