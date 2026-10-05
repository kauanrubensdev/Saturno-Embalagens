import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Tag, Boxes, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export interface ProductVariantItem {
  id?: string;
  name: string;
  sku?: string | null;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  sort_order?: number;
}

interface ProductVariantManagerProps {
  variants: ProductVariantItem[];
  onChange: (variants: ProductVariantItem[]) => void;
  basePrice?: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function ProductVariantManager({
  variants,
  onChange,
  basePrice = 20,
}: ProductVariantManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form State for the variant modal
  const [variantName, setVariantName] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantStock, setVariantStock] = useState('10');
  const [variantActive, setVariantActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenNew = () => {
    setEditingIndex(null);
    setVariantName('');
    setVariantSku('');
    setVariantPrice(basePrice.toFixed(2).replace('.', ','));
    setVariantStock('10');
    setVariantActive(true);
    setErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (index: number) => {
    const item = variants[index];
    if (!item) return;

    setEditingIndex(index);
    setVariantName(item.name);
    setVariantSku(item.sku || '');
    setVariantPrice(Number(item.price).toFixed(2).replace('.', ','));
    setVariantStock(String(item.stock_quantity ?? 0));
    setVariantActive(item.is_active ?? true);
    setErrors({});
    setIsModalOpen(true);
  };

  const handleDelete = (index: number) => {
    const removedName = variants[index]?.name || 'Variação';
    const updated = variants.filter((_, idx) => idx !== index);
    onChange(updated);
    toast.info(`"${removedName}" removida da lista.`);
  };

  const handleSaveVariant = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const cleanName = variantName.trim();
    if (!cleanName) {
      newErrors.name = 'Informe o tamanho ou nome da variação (ex: 20 cm).';
    }

    // Parse and validate price
    const normalizedPriceStr = variantPrice.replace(/\s+/g, '').replace('R$', '').replace(',', '.');
    const parsedPrice = parseFloat(normalizedPriceStr);

    if (variantPrice.trim() === '' || isNaN(parsedPrice) || parsedPrice < 0) {
      newErrors.price = 'Preço deve ser um valor numérico válido maior ou igual a zero.';
    }

    // Parse and validate stock
    const parsedStock = parseInt(variantStock, 10);
    if (variantStock.trim() === '' || isNaN(parsedStock) || parsedStock < 0) {
      newErrors.stock = 'Estoque deve ser um número inteiro maior ou igual a zero.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newVariant: ProductVariantItem = {
      id: editingIndex !== null ? variants[editingIndex]?.id : undefined,
      name: cleanName,
      sku: variantSku.trim() || null,
      price: Math.round(parsedPrice * 100) / 100,
      stock_quantity: parsedStock,
      is_active: variantActive,
      sort_order: editingIndex !== null ? (variants[editingIndex]?.sort_order ?? editingIndex) : variants.length,
    };

    let updatedList: ProductVariantItem[];
    if (editingIndex !== null) {
      // Update only the corresponding variant
      updatedList = variants.map((item, idx) => (idx === editingIndex ? newVariant : item));
      toast.success(`Variação "${cleanName}" atualizada!`);
    } else {
      // Add new variant
      updatedList = [...variants, newVariant];
      toast.success(`Variação "${cleanName}" adicionada!`);
    }

    onChange(updatedList);
    setIsModalOpen(false);
  };

  const handleAddDefaultSizes = () => {
    const defaultSizes: ProductVariantItem[] = [
      { name: '20 cm', sku: 'CX-20', price: 20, stock_quantity: 18, is_active: true, sort_order: 0 },
      { name: '25 cm', sku: 'CX-25', price: 25, stock_quantity: 15, is_active: true, sort_order: 1 },
      { name: '30 cm', sku: 'CX-30', price: 30, stock_quantity: 10, is_active: true, sort_order: 2 },
    ];
    onChange(defaultSizes);
    toast.success('Variações padrão (20cm, 25cm, 30cm) adicionadas!');
  };

  return (
    <div
      className="p-4 sm:p-5 rounded-2xl border space-y-4"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
              Variações do Produto (Tamanhos e Preços)
            </h3>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Defina preços e estoque específicos para cada tamanho (ex: 20cm, 25cm, 30cm).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {variants.length === 0 && (
            <button
              type="button"
              onClick={handleAddDefaultSizes}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:opacity-90 cursor-pointer active:scale-95"
              style={{
                backgroundColor: 'var(--muted)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <Tag className="w-3.5 h-3.5" />
              Sugerir 20cm, 25cm, 30cm
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 cursor-pointer active:scale-95 shadow-sm"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Variação
          </button>
        </div>
      </div>

      {/* Variants Table / List */}
      {variants.length === 0 ? (
        <div
          className="p-6 rounded-xl border border-dashed text-center space-y-2"
          style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}
        >
          <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
            Nenhuma variação cadastrada
          </p>
          <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
            O produto usará o preço padrão de cadastro. Clique em <strong>Adicionar Variação</strong> para configurar tamanhos e preços individuais.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-xs text-left">
            <thead
              className="border-b font-bold uppercase tracking-wider text-[11px]"
              style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <tr>
                <th className="py-2.5 px-3">Tamanho / Nome</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Preço</th>
                <th className="py-2.5 px-3">Estoque</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {variants.map((v, index) => (
                <tr
                  key={index}
                  className="transition-colors hover:bg-muted/40"
                  style={{ color: 'var(--foreground)' }}
                >
                  <td className="py-2.5 px-3 font-semibold">
                    <span className="text-xs">{v.name}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-muted-foreground">
                    {v.sku || '—'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className="font-bold px-2 py-0.5 rounded-md inline-block text-xs"
                      style={{
                        backgroundColor: 'rgba(234, 88, 12, 0.12)',
                        color: 'var(--primary)',
                      }}
                    >
                      {formatCurrency(v.price)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold">{v.stock_quantity} un.</span>
                  </td>
                  <td className="py-2.5 px-3">
                    {v.is_active ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(22, 163, 74, 0.12)', color: 'var(--success)' }}
                      >
                        <Check className="w-3 h-3" /> Ativo
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--destructive)' }}
                      >
                        <X className="w-3 h-3" /> Inativo
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(index)}
                        className="p-1.5 rounded-lg border hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                        title="Editar Variação"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(index)}
                        className="p-1.5 rounded-lg border hover:border-red-500/50 text-muted-foreground hover:text-red-600 transition-colors cursor-pointer"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                        title="Excluir Variação"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Editar / Criar Variação */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
              {editingIndex !== null ? 'Editar Variação' : 'Adicionar Nova Variação'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveVariant} className="space-y-4 mt-2">
            {/* Tamanho / Nome */}
            <div className="space-y-1">
              <Label htmlFor="variant-name" className="text-xs font-semibold">
                Tamanho / Nome da Variação *
              </Label>
              <Input
                id="variant-name"
                value={variantName}
                onChange={(e) => {
                  setVariantName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="Ex: 20 cm, 25 cm, 30 cm"
                className="h-10 text-xs rounded-xl"
              />
              {errors.name && <p className="text-[11px] text-destructive">{errors.name}</p>}
            </div>

            {/* SKU e Estoque */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="variant-sku" className="text-xs font-semibold">
                  SKU (Opcional)
                </Label>
                <Input
                  id="variant-sku"
                  value={variantSku}
                  onChange={(e) => setVariantSku(e.target.value)}
                  placeholder="Ex: CX-20"
                  className="h-10 text-xs rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="variant-stock" className="text-xs font-semibold">
                  Estoque *
                </Label>
                <Input
                  id="variant-stock"
                  type="number"
                  min="0"
                  value={variantStock}
                  onChange={(e) => {
                    setVariantStock(e.target.value);
                    if (errors.stock) setErrors((prev) => ({ ...prev, stock: '' }));
                  }}
                  placeholder="Ex: 18"
                  className="h-10 text-xs rounded-xl"
                />
                {errors.stock && <p className="text-[11px] text-destructive">{errors.stock}</p>}
              </div>
            </div>

            {/* Preço (R$) */}
            <div className="space-y-1">
              <Label htmlFor="variant-price" className="text-xs font-semibold">
                Preço Unitário da Variação (R$) *
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">
                  R$
                </span>
                <Input
                  id="variant-price"
                  type="text"
                  value={variantPrice}
                  onChange={(e) => {
                    setVariantPrice(e.target.value);
                    if (errors.price) setErrors((prev) => ({ ...prev, price: '' }));
                  }}
                  placeholder="20,00"
                  className="h-10 text-xs pl-8 rounded-xl font-semibold"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Informe o valor monetário. Ex: 20,00 ou 29,90.
              </p>
              {errors.price && <p className="text-[11px] text-destructive">{errors.price}</p>}
            </div>

            {/* Ativo / Inativo */}
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  Variação Ativa
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Quando desativada, não ficará disponível para seleção na loja.
                </p>
              </div>
              <input
                type="checkbox"
                checked={variantActive}
                onChange={(e) => setVariantActive(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
            </div>

            <DialogFooter className="pt-2 flex flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-muted/50 cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 cursor-pointer shadow-sm"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                Salvar Variação
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
