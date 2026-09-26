import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import {
  Boxes,
  Search,
  X,
  RefreshCw,
  History,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Package,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  Plus,
  Minus,
  Layers,
  Calendar,
  User,
  FileText,
} from 'lucide-react';

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

function stockStatusStyle(status: StockStatus): { bg: string; text: string; border: string; label: string } {
  switch (status) {
    case 'out':
      return {
        bg: 'rgba(220,38,38,0.12)',
        text: 'var(--destructive)',
        border: 'rgba(220,38,38,0.25)',
        label: 'Sem estoque',
      };
    case 'low':
      return {
        bg: 'rgba(251,191,36,0.12)',
        text: '#d97706',
        border: 'rgba(251,191,36,0.25)',
        label: 'Estoque baixo',
      };
    case 'ok':
      return {
        bg: 'rgba(22,163,74,0.12)',
        text: '#16a34a',
        border: 'rgba(22,163,74,0.25)',
        label: 'Em estoque',
      };
  }
}

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  in:         'Entrada',
  out:        'Saída',
  adjustment: 'Ajuste',
};

const MOVEMENT_TYPE_CONFIG: Record<MovementType, { label: string; color: string; bg: string; border: string }> = {
  in: {
    label: 'Entrada',
    color: '#16a34a',
    bg: 'rgba(22,163,74,0.12)',
    border: 'rgba(22,163,74,0.25)',
  },
  out: {
    label: 'Saída',
    color: 'var(--destructive)',
    bg: 'rgba(220,38,38,0.12)',
    border: 'rgba(220,38,38,0.25)',
  },
  adjustment: {
    label: 'Ajuste',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.12)',
    border: 'rgba(124,58,237,0.25)',
  },
};

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
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const fetchProducts = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setIsRefreshing(true);
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
      setError('Não foi possível carregar o estoque dos produtos.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchSku = p.sku?.toLowerCase().includes(q) ?? false;
        const matchCat = p.category?.name.toLowerCase().includes(q) ?? false;
        if (!matchName && !matchSku && !matchCat) return false;
      }
      return true;
    });
  }, [products, statusFilter, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

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
        toast.warning('Estoque atualizado, mas houve falha ao registrar movimentação: ' + movErr.message);
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

    try {
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
    } catch (err: any) {
      console.error('[ADMIN-STOCK] history exception:', err);
      toast.error('Erro ao carregar histórico de movimentações.');
    } finally {
      setLoadingHistory(false);
    }
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
                Estoque
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
                  {products.length} {products.length === 1 ? 'produto' : 'produtos'}
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Gerencie o estoque dos produtos com controle de entradas, saídas e histórico.
              {' '}<span className="text-xs font-medium">Alerta de estoque baixo: ≤ {LOW_STOCK_THRESHOLD} unidades.</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProducts(true)}
              disabled={isRefreshing || loading}
              aria-label="Atualizar lista de estoque"
              title="Atualizar lista de estoque"
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

        {/* ── Summary cards ── */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Total */}
            <div
              className="rounded-xl p-4 border shadow-xs"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  Total de produtos
                </span>
                <Boxes className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                {summary.total}
              </p>
            </div>

            {/* Disponíveis */}
            <div
              className="rounded-xl p-4 border shadow-xs"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  Em estoque
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {summary.available}
              </p>
            </div>

            {/* Estoque baixo */}
            <div
              className="rounded-xl p-4 border shadow-xs"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  Estoque baixo
                </span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {summary.lowStock}
              </p>
            </div>

            {/* Sem estoque */}
            <div
              className="rounded-xl p-4 border shadow-xs"
              style={{
                backgroundColor: 'var(--card)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  Sem estoque
                </span>
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {summary.outOfStock}
              </p>
            </div>
          </div>
        )}

        {/* ── Filters & Search ── */}
        <div
          className="p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row gap-3 sm:items-center"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              type="text"
              placeholder="Buscar por nome, SKU ou categoria..."
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

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | StockStatus)}
            aria-label="Filtrar por nível de estoque"
            className="w-full sm:w-48 px-3 py-2 rounded-lg border text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            style={{
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            <option value="all">Todos os níveis</option>
            <option value="ok">Em estoque</option>
            <option value="low">Estoque baixo (≤ 10)</option>
            <option value="out">Sem estoque (0)</option>
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
            {/* Desktop skeleton */}
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
                    <div className="w-9 h-9 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                      <div className="h-3 w-1/2 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    </div>
                  </div>
                  <div className="h-4 w-24 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-4 w-20 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-4 w-12 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="h-6 w-24 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="flex gap-2">
                    <div className="h-8 w-20 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-8 w-20 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile skeleton */}
            <div className="md:hidden space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border p-4 space-y-3 animate-pulse"
                  style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex justify-between">
                    <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-5 w-20 rounded-full" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                  <div className="h-3 w-24 rounded" style={{ backgroundColor: 'var(--muted)' }} />
                  <div className="flex gap-2 pt-2">
                    <div className="h-8 flex-1 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-8 flex-1 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
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
              Não foi possível carregar o estoque.
            </h3>
            <p className="text-xs mb-6" style={{ color: 'var(--muted-foreground)' }}>
              Verifique sua conexão e tente novamente.
            </p>
            <button
              onClick={() => fetchProducts()}
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
        ) : filteredProducts.length === 0 ? (
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
              <Boxes className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              {products.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto corresponde aos filtros'}
            </h3>
            <p className="text-sm max-w-md mx-auto mb-6" style={{ color: 'var(--muted-foreground)' }}>
              {products.length === 0
                ? 'Cadastre produtos no módulo de Produtos para gerenciar seu estoque.'
                : 'Tente ajustar os filtros ou os termos de busca.'}
            </p>

            {products.length === 0 ? (
              <button
                onClick={() => navigate({ to: '/admin/products' })}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }}
              >
                <Package className="w-4 h-4" />
                Ir para Produtos
              </button>
            ) : hasActiveFilters ? (
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
            ) : null}
          </div>
        ) : (
          <>
            {/* ── Summary Counter ── */}
            <div className="text-xs px-1" style={{ color: 'var(--muted-foreground)' }}>
              {filteredProducts.length} {filteredProducts.length === 1 ? 'produto exibido' : 'produtos exibidos'}
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
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3 text-center">Qtd Atual</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredProducts.map((product) => {
                    const status = getStockStatus(product.stock_quantity);
                    const ss = stockStatusStyle(status);

                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-muted/40 transition-colors"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {/* Name */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0"
                              style={{
                                backgroundColor: 'var(--background)',
                                borderColor: 'var(--border)',
                                color: 'var(--primary)',
                              }}
                            >
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-sm block truncate">
                                {product.name}
                              </span>
                              {!product.is_active && (
                                <span
                                  className="inline-block text-[10px] font-medium px-1.5 py-0.2 rounded border mt-0.5"
                                  style={{
                                    backgroundColor: 'var(--muted)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--muted-foreground)',
                                  }}
                                >
                                  Inativo na loja
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-muted-foreground">
                            {product.category?.name ?? '—'}
                          </span>
                        </td>

                        {/* SKU */}
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs text-muted-foreground">
                            {product.sku ?? '—'}
                          </span>
                        </td>

                        {/* Stock Quantity */}
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className="text-sm font-bold font-mono px-2 py-1 rounded"
                            style={{
                              color: status === 'ok' ? 'var(--foreground)' : ss.text,
                              backgroundColor: status === 'ok' ? 'transparent' : ss.bg,
                            }}
                          >
                            {product.stock_quantity}
                          </span>
                        </td>

                        {/* Status badge */}
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
                            style={{
                              backgroundColor: ss.bg,
                              color: ss.text,
                              borderColor: ss.border,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ss.text }} />
                            {ss.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openHistory(product)}
                              aria-label={`Ver histórico de ${product.name}`}
                              title="Ver histórico de movimentações"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80 cursor-pointer"
                              style={{
                                backgroundColor: 'var(--background)',
                                borderColor: 'var(--border)',
                                color: 'var(--foreground)',
                              }}
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>Histórico</span>
                            </button>

                            <button
                              onClick={() => openAdjust(product)}
                              aria-label={`Ajustar estoque de ${product.name}`}
                              title="Ajustar quantidade de estoque"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 cursor-pointer shadow-xs"
                              style={{
                                backgroundColor: 'var(--primary)',
                                color: 'var(--primary-foreground)',
                              }}
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                              <span>Ajustar</span>
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
                    className="rounded-xl p-4 border space-y-3 shadow-xs"
                    style={{
                      backgroundColor: 'var(--card)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                            {product.name}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {product.category?.name ?? 'Sem categoria'}
                          {product.sku && ` · SKU: ${product.sku}`}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold font-mono" style={{ color: status === 'ok' ? 'var(--foreground)' : ss.text }}>
                          {product.stock_quantity} un.
                        </p>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border mt-0.5"
                          style={{
                            backgroundColor: ss.bg,
                            color: ss.text,
                            borderColor: ss.border,
                          }}
                        >
                          {ss.label}
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 pt-2.5 border-t text-xs"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <button
                        onClick={() => openHistory(product)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg font-medium border transition-colors hover:opacity-80 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--background)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)',
                        }}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Histórico</span>
                      </button>

                      <button
                        onClick={() => openAdjust(product)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg font-semibold transition-all hover:opacity-90 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--primary)',
                          color: 'var(--primary-foreground)',
                        }}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Ajustar</span>
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
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  Ajustar Estoque
                </DialogTitle>
                <DialogDescription style={{ color: 'var(--muted-foreground)' }}>
                  Registre uma movimentação de entrada, saída ou correção.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {adjustTarget && (
            <div className="space-y-4 py-2">
              {/* Target Product Summary */}
              <div
                className="p-3 rounded-xl border text-xs space-y-1"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                }}
              >
                <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                  {adjustTarget.name}
                </p>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>SKU: {adjustTarget.sku || '—'}</span>
                  <span>
                    Estoque atual: <strong style={{ color: 'var(--foreground)' }}>{adjustTarget.stock_quantity} unidades</strong>
                  </span>
                </div>
              </div>

              {/* Movement Type Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Tipo de Movimentação <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['in', 'out', 'adjustment'] as MovementType[]).map((t) => {
                    const isSelected = adjType === t;
                    const cfg = MOVEMENT_TYPE_CONFIG[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAdjType(t)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected ? 'shadow-xs ring-1 ring-primary/30' : 'hover:opacity-80'
                        }`}
                        style={{
                          backgroundColor: isSelected ? cfg.bg : 'var(--background)',
                          borderColor: isSelected ? cfg.border : 'var(--border)',
                          color: isSelected ? cfg.color : 'var(--muted-foreground)',
                        }}
                      >
                        {t === 'in' && <ArrowUpRight className="w-3.5 h-3.5" />}
                        {t === 'out' && <ArrowDownRight className="w-3.5 h-3.5" />}
                        {t === 'adjustment' && <SlidersHorizontal className="w-3.5 h-3.5" />}
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  {adjType === 'in'  && 'Adiciona unidades à quantidade atual.'}
                  {adjType === 'out' && 'Subtrai unidades da quantidade atual (mínimo 0).'}
                  {adjType === 'adjustment' && 'Define o valor total exato no estoque.'}
                </p>
              </div>

              {/* Quantity Input with Realtime Result Preview */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  {adjType === 'adjustment' ? 'Nova Quantidade Absoluta' : 'Quantidade da Movimentação'}{' '}
                  <span style={{ color: 'var(--destructive)' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  disabled={saving}
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  placeholder={adjType === 'adjustment' ? 'Ex.: 50' : 'Ex.: 10'}
                  className="w-full px-3 py-2 rounded-lg border text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />

                {adjQty && !isNaN(parseInt(adjQty, 10)) && parseInt(adjQty, 10) > 0 && (
                  <div
                    className="p-2.5 rounded-lg border text-xs mt-2 flex items-center justify-between"
                    style={{
                      backgroundColor: 'var(--background)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <span className="text-muted-foreground">Estoque resultante:</span>
                    <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>
                      {computeNewQty(adjustTarget.stock_quantity, adjType, parseInt(adjQty, 10))} unidades
                    </span>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Motivo <span className="font-normal normal-case text-muted-foreground">(opcional)</span>
                </label>
                <input
                  type="text"
                  disabled={saving}
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="Ex.: Compra de fornecedor, contagem de inventário, perda..."
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                  Referência / Documento <span className="font-normal normal-case text-muted-foreground">(opcional)</span>
                </label>
                <input
                  type="text"
                  disabled={saving}
                  value={adjReference}
                  onChange={(e) => setAdjReference(e.target.value)}
                  placeholder="Ex.: NF-e 1024, Pedido #842..."
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:opacity-80 disabled:opacity-50 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdjustment}
                  disabled={saving || !adjQty || isNaN(parseInt(adjQty, 10)) || parseInt(adjQty, 10) <= 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registrando movimentação...</span>
                    </>
                  ) : (
                    'Confirmar ajuste'
                  )}
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
                <History className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>
                  Histórico — {historyProduct?.name}
                </DialogTitle>
                <DialogDescription style={{ color: 'var(--muted-foreground)' }}>
                  Últimas 100 movimentações registradas para este item.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loadingHistory ? (
            <div className="space-y-3 py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              <p className="text-xs text-muted-foreground">Carregando histórico de movimentações...</p>
            </div>
          ) : movements.length === 0 ? (
            <div
              className="py-10 text-center border rounded-xl"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
              }}
            >
              <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Nenhuma movimentação registrada
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                As entradas, saídas ou cancelamentos de pedidos aparecerão aqui.
              </p>
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-xl border mt-2"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
              }}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className="border-b font-semibold uppercase tracking-wider text-muted-foreground"
                    style={{
                      backgroundColor: 'var(--muted)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <th className="px-3 py-2.5 text-left">Data</th>
                    <th className="px-3 py-2.5 text-left">Tipo</th>
                    <th className="px-3 py-2.5 text-center">Qtd</th>
                    <th className="px-3 py-2.5 text-left">Motivo</th>
                    <th className="px-3 py-2.5 text-left">Referência</th>
                    <th className="px-3 py-2.5 text-left">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {movements.map((mov) => {
                    const cfg = MOVEMENT_TYPE_CONFIG[mov.movement_type];
                    return (
                      <tr key={mov.id} style={{ color: 'var(--foreground)' }}>
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                          {formatDateTime(mov.created_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                            style={{
                              backgroundColor: cfg.bg,
                              color: cfg.color,
                              borderColor: cfg.border,
                            }}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold" style={{ color: cfg.color }}>
                          {signedQty(mov.movement_type, mov.quantity)}
                        </td>
                        <td className="px-3 py-2.5 max-w-[150px] truncate" title={mov.reason || undefined}>
                          {mov.reason ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-muted-foreground max-w-[120px] truncate" title={mov.reference || undefined}>
                          {mov.reference ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                          {(mov.performer as unknown as { name: string } | null)?.name ?? 'Sistema'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
