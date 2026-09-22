import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  preparing: 'Em preparo',
  shipped:   'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
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

function roleBadge(role: CustomerRole): { bg: string; text: string; label: string } {
  if (role === 'admin') {
    return { bg: 'rgba(249,115,22,0.12)', text: '#ea580c', label: 'Admin' };
  }
  return { bg: 'rgba(59,130,246,0.12)', text: '#2563eb', label: 'Cliente' };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function shortId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
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
  const [error, setError] = useState<string | null>(null);

  // filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // detail modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => { fetchCustomers(); }, []);

  // ── Fetch all customers ──────────────────────────────────────────────────
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, name, phone, role, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setCustomers((data as Customer[]) || []);
    } catch (err) {
      console.error('[ADMIN-CUSTOMERS] fetchCustomers error:', err);
      setError('Erro ao carregar clientes. Verifique se a policy RLS "Admin vê todos os perfis" está ativa.');
    } finally {
      setLoading(false);
    }
  };

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
        const q = searchQuery.toLowerCase();
        const matchName  = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchPhone) return false;
      }
      return true;
    });
  }, [customers, roleFilter, searchQuery]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              Clientes
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Consulte os clientes cadastrados na loja.
            </p>
          </div>
          <button
            onClick={fetchCustomers}
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
              placeholder="Buscar por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-44 px-3 py-2.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="all">Todos os perfis</option>
            <option value="customer">Clientes</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
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
            <button onClick={fetchCustomers} className="text-sm font-medium hover:underline cursor-pointer" style={{ color: 'var(--primary)' }}>
              Tentar novamente
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div
            className="p-12 rounded-xl text-center"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--muted)' }}>
              <svg className="w-8 h-8" style={{ color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              {customers.length === 0 ? 'Nenhum cliente encontrado' : 'Nenhum resultado para os filtros'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {customers.length === 0
                ? 'Quando clientes se cadastrarem na loja eles aparecerão aqui.'
                : 'Tente ajustar os filtros ou os termos de busca.'}
            </p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {filteredCustomers.length} {filteredCustomers.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden md:block overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--muted)' }}>
                    {['Cliente', 'Telefone', 'Perfil', 'Cadastrado em', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${i >= 4 ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: 'var(--card)' }}>
                  {filteredCustomers.map((customer, idx) => {
                    const rb = roleBadge(customer.role);
                    return (
                      <tr key={customer.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                        {/* Avatar + Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                            >
                              {getInitials(customer.name)}
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                              {customer.name}
                            </span>
                          </div>
                        </td>
                        {/* Phone */}
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            {customer.phone ?? '—'}
                          </span>
                        </td>
                        {/* Role */}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: rb.bg, color: rb.text }}
                          >
                            {rb.label}
                          </span>
                        </td>
                        {/* Registered at */}
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {formatDate(customer.created_at)}
                          </span>
                        </td>
                        {/* Action */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openDetail(customer)}
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
              {filteredCustomers.map((customer) => {
                const rb = roleBadge(customer.role);
                return (
                  <div
                    key={customer.id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold"
                          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                        >
                          {getInitials(customer.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                            {customer.name}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                            {customer.phone ?? 'Sem telefone'}
                          </p>
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0"
                        style={{ backgroundColor: rb.bg, color: rb.text }}
                      >
                        {rb.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        Desde {formatDate(customer.created_at)}
                      </span>
                      <button
                        onClick={() => openDetail(customer)}
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
              {selectedCustomer ? `Detalhes — ${selectedCustomer.name}` : 'Detalhes'}
            </DialogTitle>
          </DialogHeader>

          {!selectedCustomer ? null : loadingDetail ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--muted)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-6 py-2">

              {/* Detail error notice */}
              {detailError && (
                <div
                  className="p-3 rounded-lg text-xs"
                  style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: 'var(--destructive)', border: '1px solid rgba(220,38,38,0.2)' }}
                >
                  <strong>Aviso:</strong> {detailError}
                </div>
              )}

              {/* ── Profile info ── */}
              <section>
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    {getInitials(selectedCustomer.name)}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                      {selectedCustomer.name}
                    </h3>
                    {(() => {
                      const rb = roleBadge(selectedCustomer.role);
                      return (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1"
                          style={{ backgroundColor: rb.bg, color: rb.text }}
                        >
                          {rb.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span style={{ color: 'var(--muted-foreground)' }}>Telefone:</span>
                  <span style={{ color: 'var(--foreground)' }}>{selectedCustomer.phone ?? '—'}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>Cadastrado em:</span>
                  <span style={{ color: 'var(--foreground)' }}>{formatDateTime(selectedCustomer.created_at)}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>Última atualização:</span>
                  <span style={{ color: 'var(--foreground)' }}>{formatDateTime(selectedCustomer.updated_at)}</span>
                </div>


              </section>

              {/* ── Addresses ── */}
              <section>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                  Endereços{' '}
                  <span className="font-normal text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    ({selectedCustomer.addresses.length})
                  </span>
                </h3>

                {selectedCustomer.addresses.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Nenhum endereço cadastrado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="p-3 rounded-lg text-sm relative"
                        style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
                      >
                        {addr.is_default && (
                          <span
                            className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
                          >
                            Padrão
                          </span>
                        )}
                        <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                          {addr.street}, {addr.number}
                          {addr.complement && `, ${addr.complement}`}
                        </p>
                        <p style={{ color: 'var(--muted-foreground)' }}>
                          {addr.neighborhood} · {addr.city}/{addr.state}
                        </p>
                        <p style={{ color: 'var(--muted-foreground)' }}>CEP: {addr.zip_code}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Orders ── */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    Pedidos{' '}
                    <span className="font-normal text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      ({selectedCustomer.orders.length})
                    </span>
                  </h3>
                  {selectedCustomer.orders.length > 0 && (
                    <button
                      onClick={goToOrders}
                      className="text-xs font-medium hover:underline cursor-pointer"
                      style={{ color: 'var(--primary)' }}
                    >
                      Ver todos os pedidos →
                    </button>
                  )}
                </div>

                {selectedCustomer.orders.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    Este cliente ainda não realizou pedidos.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: 'var(--muted)' }}>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Pedido</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Data</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Total</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody style={{ backgroundColor: 'var(--card)' }}>
                        {selectedCustomer.orders.map((order, idx) => {
                          const sc = statusColor(order.status);
                          return (
                            <tr
                              key={order.id}
                              style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}
                            >
                              <td className="px-3 py-2">
                                <button
                                  onClick={goToOrders}
                                  className="font-mono text-xs font-semibold hover:underline cursor-pointer"
                                  style={{ color: 'var(--primary)' }}
                                  title="Ir para a página de Pedidos"
                                >
                                  {shortId(order.id)}
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                  {formatDate(order.created_at)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                                  {formatCurrency(order.total)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: sc.bg, color: sc.text }}
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
                )}

                {/* Total spent summary */}
                {selectedCustomer.orders.length > 0 && (
                  <div className="mt-2 flex justify-end">
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      Total gasto:{' '}
                      <strong style={{ color: 'var(--foreground)' }}>
                        {formatCurrency(selectedCustomer.orders.reduce((s, o) => s + o.total, 0))}
                      </strong>
                    </span>
                  </div>
                )}
              </section>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
