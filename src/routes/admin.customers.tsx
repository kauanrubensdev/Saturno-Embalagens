import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Users,
  Search,
  X,
  RefreshCw,
  Eye,
  Calendar,
  Phone,
  MapPin,
  ShoppingBag,
  AlertTriangle,
  Loader2,
  Shield,
  User,
  ArrowRight,
} from 'lucide-react';

// ─── Domain types ─────────────────────────────────────────────────────────────

type CustomerRole = 'customer' | 'admin';
type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

interface CustomerAddress {
  id: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

interface CustomerOrderSummary {
  id: string;
  status: OrderStatus;
  total: number;
  delivery_type: string;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  role: CustomerRole;
  created_at: string;
  updated_at: string;
}

interface CustomerDetail extends Customer {
  addresses: CustomerAddress[];
  orders: CustomerOrderSummary[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending:   'Pendente',
  confirmed: 'Confirmado',
  preparing: 'Em preparação',
  shipped:   'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

function statusColor(status: OrderStatus): { bg: string; text: string; border: string } {
  switch (status) {
    case 'pending':   return { bg: 'rgba(251,191,36,0.12)', text: '#d97706', border: 'rgba(251,191,36,0.3)' };
    case 'confirmed': return { bg: 'rgba(59,130,246,0.12)', text: '#2563eb', border: 'rgba(59,130,246,0.3)' };
    case 'preparing': return { bg: 'rgba(139,92,246,0.12)', text: '#7c3aed', border: 'rgba(139,92,246,0.3)' };
    case 'shipped':   return { bg: 'rgba(234,88,12,0.12)',  text: '#ea580c', border: 'rgba(234,88,12,0.3)' };
    case 'delivered': return { bg: 'rgba(22,163,74,0.12)',  text: 'var(--success)', border: 'rgba(22,163,74,0.3)' };
    case 'cancelled': return { bg: 'rgba(220,38,38,0.12)',  text: 'var(--destructive)', border: 'rgba(220,38,38,0.3)' };
    default:          return { bg: 'var(--muted)',          text: 'var(--muted-foreground)', border: 'var(--border)' };
  }
}

function roleBadge(role: CustomerRole): { bg: string; text: string; border: string; label: string } {
  if (role === 'admin') {
    return {
      bg: 'rgba(249,115,22,0.12)',
      text: '#ea580c',
      border: 'rgba(249,115,22,0.3)',
      label: 'Administrador',
    };
  }
  return {
    bg: 'rgba(59,130,246,0.12)',
    text: '#2563eb',
    border: 'rgba(59,130,246,0.3)',
    label: 'Cliente',
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function getInitials(name: string): string {
  if (!name) return 'CL';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/admin/customers')({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.authReady) return;
    if (!context.auth?.user) throw redirect({ to: '/login' });
    if (!context.auth?.profile || context.auth.profile.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  component: AdminCustomersPage,
});

// ─── Component ────────────────────────────────────────────────────────────────

function AdminCustomersPage() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // detail modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ── Fetch all customers ──────────────────────────────────────────────────
  const fetchCustomers = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, name, phone, role, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setCustomers((data as Customer[]) || []);
    } catch (err) {
      console.error('[ADMIN-CUSTOMERS] fetchCustomers error:', err);
      setError('Não foi possível carregar os clientes.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ── Fetch detail (addresses + orders) ───────────────────────────────────
  const openDetail = async (customer: Customer) => {
    setSelectedCustomer({ ...customer, addresses: [], orders: [] });
    setIsDetailOpen(true);
    setLoadingDetail(true);
    setDetailError(null);

    try {
      const [addressesRes, ordersRes] = await Promise.all([
        supabase
          .from('addresses')
          .select('id, street, number, complement, neighborhood, city, state, zip_code, is_default')
          .eq('user_id', customer.id)
          .order('is_default', { ascending: false }),
        supabase
          .from('orders')
          .select('id, status, total, delivery_type, created_at')
          .eq('user_id', customer.id)
          .order('created_at', { ascending: false }),
      ]);

      const addressErr = addressesRes.error;
      const ordersErr  = ordersRes.error;

      if (addressErr) {
        console.warn('[ADMIN-CUSTOMERS] addresses blocked:', addressErr.message);
      }
      if (ordersErr) {
        console.warn('[ADMIN-CUSTOMERS] orders blocked:', ordersErr.message);
      }

      setSelectedCustomer({
        ...customer,
        addresses: (addressesRes.data as CustomerAddress[]) || [],
        orders:    (ordersRes.data as CustomerOrderSummary[]) || [],
      });

      if (addressErr || ordersErr) {
        setDetailError(
          [
            addressErr ? `Endereços: ${addressErr.message}` : null,
            ordersErr  ? `Pedidos: ${ordersErr.message}` : null,
          ].filter(Boolean).join(' | ')
        );
      }
    } catch (err) {
      console.error('[ADMIN-CUSTOMERS] openDetail error:', err);
      setDetailError('Erro ao carregar detalhes do cliente.');
    } finally {
      setLoadingDetail(false);
    }
  };

  // ── Navigate to /admin/orders ────────────────────────────────────────────
  const goToOrders = () => {
    setIsDetailOpen(false);
    navigate({ to: '/admin/orders' });
  };

  // ── Filtered list ────────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (roleFilter !== 'all' && c.role !== roleFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName  = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchPhone) return false;
      }
      return true;
    });
  }, [customers, roleFilter, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== '' || roleFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>
                Clientes
              </h1>
              {!loading && (
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                  style={{
                    backgroundColor: 'var(--muted)',
                    borderColor: 'var(--border)',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  {customers.length} {customers.length === 1 ? 'cliente' : 'clientes'}
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Consulte e acompanhe os clientes cadastrados na loja.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCustomers(true)}
              disabled={isRefreshing || loading}
              aria-label="Atualizar lista de clientes"
              title="Atualizar lista de clientes"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all hover:opacity-80 disabled:opacity-50 cursor-pointer"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* ── Search & Filter ── */}
        <div
          className="p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row gap-3 sm:items-center"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              type="text"
              placeholder="Buscar cliente por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-lg border text-sm transition-all outline-none focus:ring-2 focus:ring-primary/20"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca"
                title="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:opacity-80"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filtrar por perfil"
            className="w-full sm:w-44 px-3 py-2 rounded-lg border text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            style={{
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <option value="all">Todos os perfis</option>
            <option value="customer">Clientes</option>
            <option value="admin">Administradores</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              aria-label="Limpar filtros"
              title="Limpar filtros"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--muted-foreground)',
              }}
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}
        </div>

        {/* ── Content ── */}
        {loading ? (
          /* Skeletons */
          <div className="space-y-3">
            <div
              className="hidden md:block rounded-xl border overflow-hidden"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="h-11 border-b" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }} />
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 border-b last:border-0 animate-pulse"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 w-1/3">
                    <div className="w-9 h-9 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                  <div className="h-4 w-28 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-6 w-20 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-4 w-24 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-8 w-20 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                </div>
              ))}
            </div>

            <div className="md:hidden space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border p-4 space-y-3 animate-pulse"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                      <div className="h-3 w-24 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    </div>
                  </div>
                  <div className="h-8 w-full rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div
            className="p-8 sm:p-12 rounded-xl border text-center max-w-md mx-auto"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                color: 'var(--destructive)',
              }}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              Não foi possível carregar os clientes.
            </h3>
            <p className="text-xs mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Verifique sua conexão e tente novamente.
            </p>
            <button
              onClick={() => fetchCustomers()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          /* Empty States */
          <div
            className="p-8 sm:p-12 rounded-xl border text-center"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center border"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--muted-foreground)',
              }}
            >
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              {customers.length === 0 ? 'Nenhum cliente cadastrado.' : 'Nenhum cliente encontrado.'}
            </h3>
            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {customers.length === 0
                ? 'Quando novos clientes se cadastrarem na loja, eles aparecerão nesta listagem.'
                : 'Tente buscar com outros termos ou redefinir os filtros.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:opacity-80"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <X className="w-4 h-4" />
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── Summary bar ── */}
            <div className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>
              {filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente exibido' : 'clientes exibidos'}
            </div>

            {/* ── Desktop table ── */}
            <div
              className="hidden md:block overflow-hidden rounded-xl border shadow-xs"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    className="border-b text-xs font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: 'var(--muted)',
                      borderColor: 'var(--border)',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Telefone</th>
                    <th className="px-4 py-3">Perfil</th>
                    <th className="px-4 py-3">Data de Cadastro</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredCustomers.map((customer) => {
                    const rb = roleBadge(customer.role);
                    return (
                      <tr
                        key={customer.id}
                        className="hover:bg-muted/40 transition-colors"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {/* Avatar + Name */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border"
                              style={{
                                backgroundColor: customer.role === 'admin' ? 'var(--primary)' : 'var(--muted)',
                                color: customer.role === 'admin' ? 'var(--primary-foreground)' : 'var(--foreground)',
                                borderColor: 'var(--border)',
                              }}
                            >
                              {getInitials(customer.name)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-sm block truncate">
                                {customer.name || 'Cliente sem nome'}
                              </span>
                              <span className="font-mono text-[11px] block truncate" style={{ color: 'var(--muted-foreground)' }}>
                                {shortId(customer.id)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            <span style={{ color: customer.phone ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                              {customer.phone ?? '—'}
                            </span>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3.5">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border"
                            style={{
                              backgroundColor: rb.bg,
                              color: rb.text,
                              borderColor: rb.border,
                            }}
                          >
                            {customer.role === 'admin' ? (
                              <Shield className="w-3 h-3" />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            {rb.label}
                          </span>
                        </td>

                        {/* Registered at */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDate(customer.created_at)}</span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => openDetail(customer)}
                            aria-label={`Ver detalhes do cliente ${customer.name}`}
                            title="Ver detalhes do cliente"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80 cursor-pointer"
                            style={{
                              backgroundColor: 'var(--background)',
                              borderColor: 'var(--border)',
                              color: 'var(--foreground)',
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detalhes</span>
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
              {filteredCustomers.map((customer) => {
                const rb = roleBadge(customer.role);
                return (
                  <div
                    key={customer.id}
                    className="rounded-xl p-4 border space-y-3 shadow-xs"
                    style={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border"
                          style={{
                            backgroundColor: customer.role === 'admin' ? 'var(--primary)' : 'var(--muted)',
                            color: customer.role === 'admin' ? 'var(--primary-foreground)' : 'var(--foreground)',
                            borderColor: 'var(--border)',
                          }}
                        >
                          {getInitials(customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                            {customer.name || 'Cliente sem nome'}
                          </p>
                          <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                            <Phone className="w-3 h-3" />
                            <span>{customer.phone ?? 'Sem telefone'}</span>
                          </div>
                        </div>
                      </div>

                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 border"
                        style={{
                          backgroundColor: rb.bg,
                          color: rb.text,
                          borderColor: rb.border,
                        }}
                      >
                        {rb.label}
                      </span>
                    </div>

                    <div
                      className="flex items-center justify-between pt-2.5 border-t text-xs"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <span className="flex items-center gap-1" style={{ color: 'var(--muted-foreground)' }}>
                        <Calendar className="w-3.5 h-3.5" />
                        Cadastrado em {formatDate(customer.created_at)}
                      </span>

                      <button
                        onClick={() => openDetail(customer)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--background)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)',
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Detalhes</span>
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
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-2.5 pr-6">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--primary)',
                }}
              >
                <User className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  {selectedCustomer ? `Cliente: ${selectedCustomer.name}` : 'Detalhes do Cliente'}
                </DialogTitle>
                <DialogDescription style={{ color: 'var(--muted-foreground)' }}>
                  Histórico de pedidos e endereços cadastrados.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {!selectedCustomer ? null : loadingDetail ? (
            <div className="space-y-3 py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              <p className="text-xs text-muted-foreground">Carregando detalhes do cliente...</p>
            </div>
          ) : (
            <div className="space-y-6 py-2">

              {/* Detail error notice if any */}
              {detailError && (
                <div
                  className="p-3 rounded-xl text-xs border"
                  style={{
                    backgroundColor: 'rgba(220,38,38,0.08)',
                    color: 'var(--destructive)',
                    borderColor: 'rgba(220,38,38,0.2)',
                  }}
                >
                  <strong>Aviso:</strong> {detailError}
                </div>
              )}

              {/* ── Profile Info ── */}
              <section
                className="p-4 rounded-2xl border space-y-4"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 border"
                    style={{
                      backgroundColor: selectedCustomer.role === 'admin' ? 'var(--primary)' : 'var(--muted)',
                      color: selectedCustomer.role === 'admin' ? 'var(--primary-foreground)' : 'var(--foreground)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    {getInitials(selectedCustomer.name)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
                      {selectedCustomer.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const rb = roleBadge(selectedCustomer.role);
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border"
                            style={{
                              backgroundColor: rb.bg,
                              color: rb.text,
                              borderColor: rb.border,
                            }}
                          >
                            {selectedCustomer.role === 'admin' ? (
                              <Shield className="w-3 h-3" />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            {rb.label}
                          </span>
                        );
                      })()}
                      <span className="font-mono text-xs text-muted-foreground">
                        {shortId(selectedCustomer.id)}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t text-xs"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Telefone:</span>
                    <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                      {selectedCustomer.phone ?? 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Cadastrado em:</span>
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {formatDateTime(selectedCustomer.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Última atualização:</span>
                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                      {formatDateTime(selectedCustomer.updated_at)}
                    </span>
                  </div>
                </div>
              </section>

              {/* ── Addresses ── */}
              <section className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>Endereços Cadastrados ({selectedCustomer.addresses.length})</span>
                </div>

                {selectedCustomer.addresses.length === 0 ? (
                  <div
                    className="p-4 rounded-xl border text-center text-xs text-muted-foreground"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    Nenhum endereço cadastrado por este cliente.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedCustomer.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="p-3 rounded-xl border text-xs relative space-y-1"
                        style={{
                          backgroundColor: 'var(--background)',
                          borderColor: 'var(--border)',
                        }}
                      >
                        {addr.is_default && (
                          <span
                            className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-1"
                            style={{
                              backgroundColor: 'rgba(22,163,74,0.12)',
                              color: 'var(--success)',
                              borderColor: 'rgba(22,163,74,0.3)',
                            }}
                          >
                            Endereço Padrão
                          </span>
                        )}
                        <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                          {addr.street}, {addr.number}
                          {addr.complement && ` (${addr.complement})`}
                        </p>
                        <p style={{ color: 'var(--muted-foreground)' }}>
                          {addr.neighborhood} — {addr.city}/{addr.state}
                        </p>
                        <p className="font-mono text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                          CEP: {addr.zip_code}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Orders ── */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                    <span>Histórico de Pedidos ({selectedCustomer.orders.length})</span>
                  </div>

                  {selectedCustomer.orders.length > 0 && (
                    <button
                      onClick={goToOrders}
                      className="inline-flex items-center gap-1 text-xs font-medium transition-colors hover:underline cursor-pointer"
                      style={{ color: 'var(--primary)' }}
                    >
                      <span>Ver módulo de pedidos</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {selectedCustomer.orders.length === 0 ? (
                  <div
                    className="p-4 rounded-xl border text-center text-xs text-muted-foreground"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    Este cliente ainda não realizou pedidos.
                  </div>
                ) : (
                  <>
                    <div
                      className="overflow-hidden rounded-xl border"
                      style={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--muted)' }}>
                            <th className="px-3 py-2 text-left font-semibold uppercase text-muted-foreground">Pedido</th>
                            <th className="px-3 py-2 text-left font-semibold uppercase text-muted-foreground">Data</th>
                            <th className="px-3 py-2 text-right font-semibold uppercase text-muted-foreground">Total</th>
                            <th className="px-3 py-2 text-right font-semibold uppercase text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                          {selectedCustomer.orders.map((order) => {
                            const sc = statusColor(order.status);
                            return (
                              <tr key={order.id} style={{ color: 'var(--foreground)' }}>
                                <td className="px-3 py-2.5">
                                  <button
                                    onClick={goToOrders}
                                    className="font-mono text-xs font-semibold hover:underline cursor-pointer"
                                    style={{ color: 'var(--primary)' }}
                                    title="Ir para a página de Pedidos"
                                  >
                                    {shortId(order.id)}
                                  </button>
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground">
                                  {formatDate(order.created_at)}
                                </td>
                                <td className="px-3 py-2.5 text-right font-bold">
                                  {formatCurrency(order.total)}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                                    style={{
                                      backgroundColor: sc.bg,
                                      color: sc.text,
                                      borderColor: sc.border,
                                    }}
                                  >
                                    {ORDER_STATUS_LABELS[order.status]}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Total spent summary */}
                    <div
                      className="p-3 rounded-xl border flex items-center justify-between text-xs"
                      style={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      <span className="text-muted-foreground">Volume total de compras:</span>
                      <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>
                        {formatCurrency(selectedCustomer.orders.reduce((s, o) => s + o.total, 0))}
                      </span>
                    </div>
                  </>
                )}
              </section>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
