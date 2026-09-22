import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Limite de "estoque baixo" — sem campo no schema, definido aqui como UI-only. */
const LOW_STOCK_THRESHOLD = 10;

// ─── Domain types ─────────────────────────────────────────────────────────────

type MovementType = 'in' | 'out' | 'adjustment';

interface StockProduct {
  id: string;
  name: string;
  sku: string | null;
  stock_quantity: number;
  is_active: boolean;
  category: { id: string; name: string } | null;
}

interface StockMovement {
  id: string;
  product_id: string;
  quantity: number;
  movement_type: MovementType;
  reason: string | null;
  reference: string | null;
  performed_by: string | null;
  created_at: string;
  performer?: { name: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type StockStatus = 'out' | 'low' | 'ok';

function getStockStatus(qty: number): StockStatus {
  if (qty === 0) return 'out';
  if (qty <= LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

function stockStatusStyle(status: StockStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'out': return { bg: 'rgba(220,38,38,0.12)',  text: 'var(--destructive)', label: 'Sem estoque' };
    case 'low': return { bg: 'rgba(251,191,36,0.12)', text: '#d97706',            label: 'Estoque baixo' };
    case 'ok':  return { bg: 'rgba(22,163,74,0.12)',  text: '#16a34a',            label: 'Disponível' };
  }
}

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  in:         'Entrada',
  out:        'Saída',
  adjustment: 'Ajuste',
};

const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
  in:         '#16a34a',
  out:        'var(--destructive)',
  adjustment: '#7c3aed',
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function signedQty(movement_type: MovementType, quantity: number): string {
  if (movement_type === 'in') return `+${quantity}`;
  if (movement_type === 'out') return `-${quantity}`;
  return `±${quantity}`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/admin/stock')({
  beforeLoad: async ({ context }) => {
    if (!context.auth?.authReady) return;
    if (!context.auth?.user) throw redirect({ to: '/login' });
    if (!context.auth?.profile || context.auth.profile.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  component: AdminStockPage,
});

// ─── Component ────────────────────────────────────────────────────────────────

function AdminStockPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── State ────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StockStatus>('all');

  // adjustment modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<StockProduct | null>(null);
  const [adjType, setAdjType] = useState<MovementType>('in');
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjReference, setAdjReference] = useState('');
  const [saving, setSaving] = useState(false);

  // history modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<StockProduct | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products')
        .select(`
          id, name, sku, stock_quantity, is_active,
          category:categories!products_category_id_fkey ( id, name )
        `)
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;
      setProducts((data as unknown as StockProduct[]) || []);
    } catch (err) {
      console.error('[ADMIN-STOCK] fetchProducts error:', err);
      setError('Erro ao carregar produtos. Verifique a policy RLS "Admin gerencia produtos".');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // ── Stock summary ─────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const total = products.length;
    const outOfStock = products.filter((p) => p.stock_quantity === 0).length;
    const lowStock   = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= LOW_STOCK_THRESHOLD).length;
    const available  = products.filter((p) => p.stock_quantity > LOW_STOCK_THRESHOLD).length;
    return { total, outOfStock, lowStock, available };
  }, [products]);

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const status = getStockStatus(p.stock_quantity);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.sku?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [products, statusFilter, searchQuery]);

  // ── Adjustment modal ──────────────────────────────────────────────────────

  const openAdjust = (product: StockProduct) => {
    setAdjustTarget(product);
    setAdjType('in');
    setAdjQty('');
    setAdjReason('');
    setAdjReference('');
    setIsAdjustOpen(true);
  };

  /**
   * Compute the new stock_quantity from the movement type + amount.
   * 'in'  → add
   * 'out' → subtract
   * 'adjustment' → set directly (treat quantity as absolute target)
   */
  const computeNewQty = (current: number, type: MovementType, qty: number): number => {
    if (type === 'in')  return current + qty;
    if (type === 'out') return Math.max(0, current - qty);
    // adjustment: qty is the new absolute value
    return Math.max(0, qty);
  };

  const handleSaveAdjustment = async () => {
    if (!adjustTarget || !user) return;

    const qtyNum = parseInt(adjQty, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error('Informe uma quantidade válida (número inteiro positivo).');
      return;
    }

    const newQty = computeNewQty(adjustTarget.stock_quantity, adjType, qtyNum);

    try {
      setSaving(true);

      // 1. Update products.stock_quantity (trigger only blocks non-admins)
      const { error: productErr } = await supabase
        .from('products')
        .update({ stock_quantity: newQty })
        .eq('id', adjustTarget.id);

      if (productErr) {
        throw new Error(`Produtos: ${productErr.message}`);
      }

      // 2. Record movement in stock_movements
      const { error: movErr } = await supabase
        .from('stock_movements')
        .insert({
          product_id:    adjustTarget.id,
          quantity:      qtyNum,
          movement_type: adjType,
          reason:        adjReason.trim() || null,
          reference:     adjReference.trim() || null,
          performed_by:  user.id,
        });

      if (movErr) {
        // Movement failed but stock was already updated — warn but don't rollback
        console.error('[ADMIN-STOCK] stock_movements insert error:', movErr);
        toast.warning('Estoque atualizado, mas falha ao registrar movimentação: ' + movErr.message);
      } else {
        toast.success('Estoque atualizado e movimentação registrada com sucesso!');
      }

      // Optimistic update in local state
      setProducts((prev) =>
        prev.map((p) => p.id === adjustTarget.id ? { ...p, stock_quantity: newQty } : p)
      );

      setIsAdjustOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[ADMIN-STOCK] saveAdjustment error:', msg);
      toast.error('Erro ao ajustar estoque: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  // ── History modal ─────────────────────────────────────────────────────────

  const openHistory = async (product: StockProduct) => {
    setHistoryProduct(product);
    setMovements([]);
    setIsHistoryOpen(true);
    setLoadingHistory(true);

    const { data, error: histErr } = await supabase
      .from('stock_movements')
      .select(`
        id, product_id, quantity, movement_type, reason, reference, performed_by, created_at,
        performer:profiles!stock_movements_performed_by_fkey ( name )
      `)
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (histErr) {
      console.error('[ADMIN-STOCK] history error:', histErr);
      toast.error('Erro ao carregar histórico: ' + histErr.message);
    }
    setMovements((data as unknown as StockMovement[]) || []);
    setLoadingHistory(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
              Estoque
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Gerencie o estoque dos produtos da loja.
              {' '}<span className="text-xs">Estoque baixo: ≤ {LOW_STOCK_THRESHOLD} unidades.</span>
            </p>
          </div>
          <button
            onClick={fetchProducts}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 cursor-pointer"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {/* ── Summary cards ── */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total de produtos', value: summary.total,      color: 'var(--foreground)',  bg: 'var(--muted)' },
              { label: 'Disponíveis',       value: summary.available,  color: '#16a34a',            bg: 'rgba(22,163,74,0.08)' },
              { label: 'Estoque baixo',     value: summary.lowStock,   color: '#d97706',            bg: 'rgba(251,191,36,0.08)' },
              { label: 'Sem estoque',       value: summary.outOfStock, color: 'var(--destructive)', bg: 'rgba(220,38,38,0.08)' },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl p-4"
                style={{ backgroundColor: card.bg, border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  {card.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: card.color }}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3">
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
              placeholder="Buscar por nome ou SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | StockStatus)}
            className="w-full sm:w-52 px-3 py-2.5 rounded-xl border text-sm"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="all">Todos</option>
            <option value="ok">Disponíveis</option>
            <option value="low">Estoque baixo</option>
            <option value="out">Sem estoque</option>
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
            <button onClick={fetchProducts} className="text-sm font-medium hover:underline cursor-pointer" style={{ color: 'var(--primary)' }}>
              Tentar novamente
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div
            className="p-12 rounded-xl text-center"
            style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--muted)' }}>
              <svg className="w-8 h-8" style={{ color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              {products.length === 0 ? 'Nenhum produto encontrado' : 'Nenhum resultado para os filtros'}
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {products.length === 0
                ? 'Cadastre produtos em /admin/products para gerenciar o estoque.'
                : 'Tente ajustar os filtros ou os termos de busca.'}
            </p>
            {products.length === 0 && (
              <button
                onClick={() => navigate({ to: '/admin/products' })}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer hover:opacity-80"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Ir para Produtos
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'} encontrado{filteredProducts.length !== 1 ? 's' : ''}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden md:block overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--muted)' }}>
                    {['Produto', 'Categoria', 'SKU', 'Estoque', 'Status', ''].map((h, i) => (
                      <th
                        key={i}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${i >= 5 ? 'text-right' : 'text-left'}`}
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: 'var(--card)' }}>
                  {filteredProducts.map((product, idx) => {
                    const status = getStockStatus(product.stock_quantity);
                    const ss = stockStatusStyle(status);
                    return (
                      <tr key={product.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                        {/* Name */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                            {product.name}
                          </span>
                          {!product.is_active && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                              Inativo
                            </span>
                          )}
                        </td>
                        {/* Category */}
                        <td className="px-4 py-3">
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {product.category?.name ?? '—'}
                          </span>
                        </td>
                        {/* SKU */}
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {product.sku ?? '—'}
                          </span>
                        </td>
                        {/* Stock qty */}
                        <td className="px-4 py-3">
                          <span
                            className="text-sm font-bold"
                            style={{ color: status === 'ok' ? 'var(--foreground)' : ss.text }}
                          >
                            {product.stock_quantity}
                          </span>
                        </td>
                        {/* Status badge */}
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: ss.bg, color: ss.text }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ss.text }} />
                            {ss.label}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openHistory(product)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80 cursor-pointer"
                              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                            >
                              Histórico
                            </button>
                            <button
                              onClick={() => openAdjust(product)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80 cursor-pointer"
                              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                            >
                              Ajustar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="md:hidden space-y-3">
              {filteredProducts.map((product) => {
                const status = getStockStatus(product.stock_quantity);
                const ss = stockStatusStyle(status);
                return (
                  <div
                    key={product.id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {product.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {product.category?.name ?? '—'}
                          {product.sku && ` · SKU: ${product.sku}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold" style={{ color: status === 'ok' ? 'var(--foreground)' : ss.text }}>
                          {product.stock_quantity}
                        </p>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1"
                          style={{ backgroundColor: ss.bg, color: ss.text }}
                        >
                          {ss.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <button
                        onClick={() => openHistory(product)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium text-center transition-colors hover:opacity-80 cursor-pointer"
                        style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                      >
                        Histórico
                      </button>
                      <button
                        onClick={() => openAdjust(product)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-medium text-center transition-colors hover:opacity-80 cursor-pointer"
                        style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                      >
                        Ajustar estoque
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Adjustment Modal ── */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent
          className="sm:max-w-md"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>
              Ajustar estoque
            </DialogTitle>
          </DialogHeader>

          {adjustTarget && (
            <div className="space-y-5 py-2">
              {/* Product info */}
              <div
                className="p-3 rounded-xl"
                style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {adjustTarget.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Estoque atual:{' '}
                  <strong style={{ color: 'var(--foreground)' }}>{adjustTarget.stock_quantity} unidades</strong>
                </p>
              </div>

              {/* Movement type */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  Tipo de movimentação
                </label>
                <div className="flex gap-2">
                  {(['in', 'out', 'adjustment'] as MovementType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setAdjType(t)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
                      style={{
                        backgroundColor: adjType === t ? MOVEMENT_TYPE_COLORS[t] : 'var(--muted)',
                        color: adjType === t ? '#fff' : 'var(--foreground)',
                        border: `1px solid ${adjType === t ? MOVEMENT_TYPE_COLORS[t] : 'var(--border)'}`,
                      }}
                    >
                      {MOVEMENT_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  {adjType === 'in'  && 'Adiciona à quantidade atual.'}
                  {adjType === 'out' && 'Subtrai da quantidade atual (mínimo 0).'}
                  {adjType === 'adjustment' && 'Define a quantidade absoluta diretamente.'}
                </p>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  {adjType === 'adjustment' ? 'Nova quantidade' : 'Quantidade'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  placeholder={adjType === 'adjustment' ? 'Ex.: 50' : 'Ex.: 10'}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm"
                  style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
                {adjQty && !isNaN(parseInt(adjQty)) && parseInt(adjQty) > 0 && (
                  <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    Resultado:{' '}
                    <strong style={{ color: 'var(--foreground)' }}>
                      {computeNewQty(adjustTarget.stock_quantity, adjType, parseInt(adjQty))} unidades
                    </strong>
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Motivo <span className="font-normal normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Ex.: Compra de fornecedor, dano, inventário..."
                  className="w-full px-3 py-2.5 rounded-xl border text-sm"
                  style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Referência <span className="font-normal normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={adjReference}
                  onChange={(e) => setAdjReference(e.target.value)}
                  placeholder="Ex.: NF-001, Pedido #1234..."
                  className="w-full px-3 py-2.5 rounded-xl border text-sm"
                  style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsAdjustOpen(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveAdjustment}
                  disabled={saving || !adjQty || isNaN(parseInt(adjQty)) || parseInt(adjQty) <= 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {saving ? 'Salvando...' : 'Confirmar ajuste'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── History Modal ── */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--foreground)' }}>
              Histórico — {historyProduct?.name}
            </DialogTitle>
          </DialogHeader>

          {loadingHistory ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--muted)' }} />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="py-10 text-center">
              <svg className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--muted-foreground)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Nenhuma movimentação registrada para este produto.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl mt-2" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--muted)' }}>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Data</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Tipo</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Qtd</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Motivo</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Referência</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Responsável</th>
                  </tr>
                </thead>
                <tbody style={{ backgroundColor: 'var(--card)' }}>
                  {movements.map((mov, idx) => (
                    <tr key={mov.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-3 py-2">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {formatDateTime(mov.created_at)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="text-xs font-semibold"
                          style={{ color: MOVEMENT_TYPE_COLORS[mov.movement_type] }}
                        >
                          {MOVEMENT_TYPE_LABELS[mov.movement_type]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className="font-mono text-xs font-bold"
                          style={{ color: MOVEMENT_TYPE_COLORS[mov.movement_type] }}
                        >
                          {signedQty(mov.movement_type, mov.quantity)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs" style={{ color: 'var(--foreground)' }}>
                          {mov.reason ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
                          {mov.reference ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {(mov.performer as unknown as { name: string } | null)?.name ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
