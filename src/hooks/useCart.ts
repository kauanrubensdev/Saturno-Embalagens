import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image_url: string | null;
    stock_quantity: number;
    is_active: boolean;
  };
}

interface Cart {
  id: string;
  user_id: string;
  items: CartItem[];
}

export function useCart() {
  const { user, profile } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    if (!user) {
      setCart(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get or create cart
      const { data: existingCart, error: cartError } = await supabase
        .from('cart')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (cartError && cartError.code !== 'PGRST116') {
        throw new Error(cartError.message);
      }

      let cartId = existingCart?.id;

      if (!cartId) {
        // Create cart
        const { data: newCart, error: createError } = await supabase
          .from('cart')
          .insert({ user_id: user.id })
          .select('id')
          .single();

        if (createError) throw new Error(createError.message);
        cartId = newCart.id;
      }

      // Get cart items
      const { data: items, error: itemsError } = await supabase
        .from('cart_items')
        .select(`
          id,
          product_id,
          quantity,
          product:products(id, name, slug, price, image_url, stock_quantity, is_active)
        `)
        .eq('cart_id', cartId);

      if (itemsError) throw new Error(itemsError.message);

      setCart({
        id: cartId,
        user_id: user.id,
        items: (items || []).map((item: Record<string, unknown>) => ({
          ...item,
          product: item.product as CartItem['product'],
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar carrinho');
      console.error('Cart fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (productId: string, quantity: number = 1) => {
    if (!user || !cart) {
      toast.error('Faça login para adicionar itens ao carrinho');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      // Check product exists and is active
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, stock_quantity, is_active')
        .eq('id', productId)
        .eq('is_active', true)
        .single();

      if (productError || !product) {
        toast.error('Produto não disponível');
        return { success: false, error: 'Product not available' };
      }

      // Check existing item in cart
      const existingItem = cart.items.find(item => item.product_id === productId);
      const currentQty = existingItem?.quantity || 0;
      const newQty = currentQty + quantity;

      // Validate stock
      if (newQty > product.stock_quantity) {
        toast.error(`Quantidade máxima disponível: ${product.stock_quantity}`);
        return { success: false, error: 'Insufficient stock' };
      }

      if (existingItem) {
        // Update quantity
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: newQty })
          .eq('id', existingItem.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        // Insert new item
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({
            cart_id: cart.id,
            product_id: productId,
            quantity: quantity,
          });

        if (insertError) throw new Error(insertError.message);
      }

      await fetchCart();
      toast.success(`${product.name} adicionado ao carrinho`);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao adicionar item';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (!cart) return { success: false, error: 'No cart' };

    const item = cart.items.find(i => i.id === itemId);
    if (!item) return { success: false, error: 'Item not found' };

    if (quantity <= 0) {
      return removeItem(itemId);
    }

    if (quantity > item.product.stock_quantity) {
      toast.error(`Quantidade máxima disponível: ${item.product.stock_quantity}`);
      return { success: false, error: 'Insufficient stock' };
    }

    try {
      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId);

      if (updateError) throw new Error(updateError.message);

      await fetchCart();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar quantidade';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (deleteError) throw new Error(deleteError.message);

      await fetchCart();
      toast.success('Item removido do carrinho');
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao remover item';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const clearCart = async () => {
    if (!cart) return { success: false, error: 'No cart' };

    try {
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id);

      if (deleteError) throw new Error(deleteError.message);

      await fetchCart();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao limpar carrinho';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const getTotalItems = () => {
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getSubtotal = () => {
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  return {
    cart,
    loading,
    error,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    getTotalItems,
    getSubtotal,
    refetch: fetchCart,
  };
}
