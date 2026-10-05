import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Tag, Boxes, Loader2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductVariantItem {
  id?: string;
  product_id?: string;
  name: string;
  sku?: string | null;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  sort_order?: number;
}

interface ProductVariantManagerProps {
  productId?: string;
  variants: ProductVariantItem[];
  onChange: (variants: ProductVariantItem[]) => void;
  onRefresh?: () => Promise<void>;
  basePrice?: number;
  disabled?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function ProductVariantManager({
  productId,
  variants,
  onChange,
  onRefresh,
  basePrice = 20,
  disabled = false,
}: ProductVariantManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDelete = async (index: number) => {
    const variantToDelete = variants[index];
    if (!variantToDelete) return;

    if (!window.confirm(`Deseja realmente excluir a variação "${variantToDelete.name}"?`)) {
      return;
    }

    // If existing in remote database (has id and productId)
    if (productId && variantToDelete.id) {
      try {
        setDeletingId(variantToDelete.id);
        const { error: deleteErr } = await supabase
          .from('product_variants')
          .delete()
          .eq('id', variantToDelete.id);

        if (deleteErr) {
          console.error('[ProductVariants] Erro ao excluir variação do banco:', {
            error: deleteErr,
            code: deleteErr.code,
            message: deleteErr.message,
            details: deleteErr.details,
          });
          toast.error(`Erro ao excluir do banco: ${deleteErr.message || 'Falha de permissão'}`);
          return;
        }

        // Verify that record was really deleted
        const { data: checkData } = await supabase
          .from('product_variants')
          .select('id')
          .eq('id', variantToDelete.id);

        if (checkData && checkData.length > 0) {
          toast.error('A variação não pôde ser excluída do banco. Verifique permissões RLS.');
          return;
        }

        const updated = variants.filter((_, idx) => idx !== index);
        onChange(updated);
        if (onRefresh) await onRefresh();
        toast.success(`Variação "${variantToDelete.name}" excluída com sucesso!`);
      } catch (err: any) {
        console.error('[ProductVariants] Falha na exclusão:', err);
        toast.error(`Erro ao excluir: ${err.message || 'Falha inesperada'}`);
      } finally {
        setDeletingId(null);
      }
    } else {
      // Local removal (new product not yet created in DB)
      const updated = variants.filter((_, idx) => idx !== index);
      onChange(updated);
      toast.info(`"${variantToDelete.name}" removida.`);
    }
  };

  const handleSaveVariant = async (e: React.FormEvent) => {
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

    const priceNumeric = Math.round(parsedPrice * 100) / 100;
    const currentItem = editingIndex !== null ? variants[editingIndex] : null;

    // Direct database persistence when editing an existing product
    if (productId) {
      setIsSubmitting(true);
      try {
        if (currentItem && currentItem.id) {
          // UPDATE existing variant by ID
          const { data: updateData, error: updateErr } = await supabase
            .from('product_variants')
            .update({
              name: cleanName,
              sku: variantSku.trim() || null,
              price: priceNumeric,
              stock_quantity: parsedStock,
              is_active: variantActive,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentItem.id)
            .select();

          if (updateErr) {
            console.error('[ProductVariants] Erro no UPDATE da variação:', {
              id: currentItem.id,
              error: updateErr,
              code: updateErr.code,
              message: updateErr.message,
              details: updateErr.details,
            });
            toast.error(`Erro ao atualizar variação no banco: ${updateErr.message || 'Falha de permissão'}`);
            return;
          }

          if (!updateData || updateData.length === 0) {
            console.error('[ProductVariants] UPDATE afetou 0 linhas para o ID:', currentItem.id);
            toast.error('Nenhum registro foi alterado no banco. Verifique permissões RLS.');
            return;
          }

          // Strict verification step: Re-query by ID to guarantee persistence
          const { data: verifyData, error: verifyErr } = await supabase
            .from('product_variants')
            .select('id, product_id, name, sku, price, stock_quantity, is_active, sort_order')
            .eq('id', currentItem.id)
            .single();

          if (verifyErr || !verifyData) {
            console.error('[ProductVariants] Erro na confirmação do UPDATE:', verifyErr);
            toast.error('Erro ao verificar confirmação do banco de dados.');
            return;
          }

          const confirmedVariant: ProductVariantItem = {
            id: verifyData.id,
            product_id: verifyData.product_id,
            name: verifyData.name,
            sku: verifyData.sku,
            price: Number(verifyData.price),
            stock_quantity: Number(verifyData.stock_quantity),
            is_active: verifyData.is_active,
            sort_order: verifyData.sort_order,
          };

          const updatedList = variants.map((item, idx) =>
            idx === editingIndex ? confirmedVariant : item
          );
          onChange(updatedList);
          if (onRefresh) await onRefresh();
          toast.success(`Variação "${cleanName}" atualizada no banco com sucesso! (${formatCurrency(confirmedVariant.price)})`);
        } else {
          // INSERT new variant for existing product
          const { data: insertData, error: insertErr } = await supabase
            .from('product_variants')
            .insert({
              product_id: productId,
              name: cleanName,
              sku: variantSku.trim() || null,
              price: priceNumeric,
              stock_quantity: parsedStock,
              is_active: variantActive,
              sort_order: editingIndex !== null ? (currentItem?.sort_order ?? editingIndex) : variants.length,
            })
            .select()
            .single();

          if (insertErr || !insertData) {
            console.error('[ProductVariants] Erro no INSERT da variação:', {
              productId,
              error: insertErr,
              code: insertErr?.code,
              message: insertErr?.message,
              details: insertErr?.details,
            });
            toast.error(`Erro ao criar variação no banco: ${insertErr?.message || 'Falha de permissão'}`);
            return;
          }

          // Strict verification step
          const { data: verifyData, error: verifyErr } = await supabase
            .from('product_variants')
            .select('id, product_id, name, sku, price, stock_quantity, is_active, sort_order')
            .eq('id', insertData.id)
            .single();

          if (verifyErr || !verifyData) {
            console.error('[ProductVariants] Erro na verificação do INSERT:', verifyErr);
            toast.error('Erro ao confirmar gravação da variação no banco.');
            return;
          }

          const confirmedVariant: ProductVariantItem = {
            id: verifyData.id,
            product_id: verifyData.product_id,
            name: verifyData.name,
            sku: verifyData.sku,
            price: Number(verifyData.price),
            stock_quantity: Number(verifyData.stock_quantity),
            is_active: verifyData.is_active,
            sort_order: verifyData.sort_order,
          };

          let updatedList: ProductVariantItem[];
          if (editingIndex !== null) {
            updatedList = variants.map((item, idx) => (idx === editingIndex ? confirmedVariant : item));
          } else {
            updatedList = [...variants, confirmedVariant];
          }

          onChange(updatedList);
          if (onRefresh) await onRefresh();
          toast.success(`Variação "${cleanName}" cadastrada no banco com sucesso! (${formatCurrency(confirmedVariant.price)})`);
        }

        setIsModalOpen(false);
      } catch (err: any) {
        console.error('[ProductVariants] Erro inesperado ao salvar variação:', err);
        toast.error(`Erro ao salvar variação: ${err.message || 'Falha de comunicação'}`);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Local state update when creating a new product (before main product is created)
      const newVariant: ProductVariantItem = {
        id: currentItem?.id,
        name: cleanName,
        sku: variantSku.trim() || null,
        price: priceNumeric,
        stock_quantity: parsedStock,
        is_active: variantActive,
        sort_order: editingIndex !== null ? (currentItem?.sort_order ?? editingIndex) : variants.length,
      };

      let updatedList: ProductVariantItem[];
      if (editingIndex !== null) {
        updatedList = variants.map((item, idx) => (idx === editingIndex ? newVariant : item));
        toast.success(`Variação "${cleanName}" atualizada no formulário.`);
      } else {
        updatedList = [...variants, newVariant];
        toast.success(`Variação "${cleanName}" adicionada ao formulário.`);
      }

      onChange(updatedList);
      setIsModalOpen(false);
    }
  };

  const handleAddDefaultSizes = async () => {
    const defaultSizes: ProductVariantItem[] = [
      { name: '20 cm', sku: 'CX-20', price: 20, stock_quantity: 18, is_active: true, sort_order: 0 },
      { name: '25 cm', sku: 'CX-25', price: 25, stock_quantity: 15, is_active: true, sort_order: 1 },
      { name: '30 cm', sku: 'CX-30', price: 30, stock_quantity: 10, is_active: true, sort_order: 2 },
    ];

    if (productId) {
      setIsSubmitting(true);
      try {
        const payload = defaultSizes.map((s, idx) => ({
          product_id: productId,
          name: s.name,
          sku: s.sku,
          price: s.price,
          stock_quantity: s.stock_quantity,
          is_active: true,
          sort_order: idx,
        }));

        const { data: insertedData, error: insertErr } = await supabase
          .from('product_variants')
          .insert(payload)
          .select();

        if (insertErr || !insertedData) {
          console.error('[ProductVariants] Erro ao inserir tamanhos padrão:', insertErr);
          toast.error(`Erro ao salvar tamanhos padrão: ${insertErr?.message || 'Falha no banco'}`);
          return;
        }

        const formattedList: ProductVariantItem[] = insertedData.map((d: any) => ({
          id: d.id,
          product_id: d.product_id,
          name: d.name,
          sku: d.sku,
          price: Number(d.price),
          stock_quantity: Number(d.stock_quantity),
          is_active: d.is_active,
          sort_order: d.sort_order,
        }));

        onChange(formattedList);
        if (onRefresh) await onRefresh();
        toast.success('Variações padrão (20cm, 25cm, 30cm) salvas no banco com sucesso!');
      } catch (err: any) {
        console.error('[ProductVariants] Erro ao adicionar tamanhos padrão:', err);
        toast.error('Erro ao adicionar variações padrão.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      onChange(defaultSizes);
      toast.success('Variações padrão (20cm, 25cm, 30cm) adicionadas.');
    }
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
              disabled={disabled || isSubmitting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:opacity-90 cursor-pointer active:scale-95 disabled:opacity-50"
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
            disabled={disabled || isSubmitting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 cursor-pointer active:scale-95 shadow-sm disabled:opacity-50"
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
              {variants.map((v, index) => {
                const isDeleting = deletingId === v.id;
                return (
                  <tr
                    key={v.id || index}
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
                          disabled={disabled || isSubmitting || isDeleting}
                          className="p-1.5 rounded-lg border hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                          title="Editar Variação"
                          aria-label={`Editar variação ${v.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(index)}
                          disabled={disabled || isSubmitting || isDeleting}
                          className="p-1.5 rounded-lg border hover:border-red-500/50 text-muted-foreground hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
                          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
                          title="Excluir Variação"
                          aria-label={`Excluir variação ${v.name}`}
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-destructive" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Editar / Criar Variação */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !isSubmitting && setIsModalOpen(open)}>
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
                disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
                onChange={(e) => setVariantActive(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer disabled:opacity-50"
              />
            </div>

            <DialogFooter className="pt-2 flex flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors hover:bg-muted/50 cursor-pointer disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Salvar Variação</span>
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
