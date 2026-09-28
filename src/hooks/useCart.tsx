import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CartProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  image_url: string | null;
  stock_quantity: number;
  is_active: boolean;
}

export interface CartItemType {
  id: string;
  product_id: string;
  quantity: number;
  product: CartProduct;
}

export interface Cart {
  id: string;
  user_id: string;
  items: CartItemType[];
}

export interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  hasUnavailableItems: boolean;
  addToCart: (productId: string, quantity?: number) => Promise<{ success: boolean; error?: string }>;
  updateQuantity: (itemId: string, quantity: number) => Promise<{ success: boolean; error?: string }>;
  removeItem: (itemId: string) => Promise<{ success: boolean; error?: string }>;
  clearCart: () => Promise<{ success: boolean; error?: string }>;
  getTotalItems: () => number;
  getSubtotal: () => number;
  refetch: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCart = useCallback(async () => {
    if (!authReady) {
      return;
    }
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

      // Get cart items with real-time product data
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

      let adjustedAny = false;
      const validItems: CartItemType[] = [];

      for (const item of items || []) {
        if (!item.product) continue;
        const prod = item.product as CartProduct;

        let itemQty = item.quantity;
        // If product has stock > 0 but quantity exceeds current stock, adjust down to max available
        if (prod.stock_quantity > 0 && itemQty > prod.stock_quantity) {
          itemQty = prod.stock_quantity;
          adjustedAny = true;
          // Update in database
          await supabase
            .from('cart_items')
            .update({ quantity: itemQty })
            .eq('id', item.id);
        }

        validItems.push({
          id: item.id,
          product_id: item.product_id,
          quantity: itemQty,
          product: prod,
        });
      }

      if (adjustedAny) {
        toast.info('Quantidade disponível atualizada de acordo com o estoque atual.');
      }

      setCart({
        id: cartId,
        user_id: user.id,
        items: validItems,
      });
    } catch (err) {
      console.error('[CART] Fetch error:', err);
      setError('Não foi possível carregar o carrinho.');
    } finally {
      setLoading(false);
    }
  }, [user, authReady]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (productId: string, quantity: number = 1) => {
    if (!user) {
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

      if (productError || !product || product.stock_quantity <= 0) {
        toast.error('Produto não disponível no momento');
        return { success: false, error: 'Product not available' };
      }

      let currentCart = cart;
      let cartId = currentCart?.id;

      if (!cartId) {
        const { data: newCart, error: createError } = await supabase
          .from('cart')
          .insert({ user_id: user.id })
          .select('id')
          .single();

        if (createError) throw new Error(createError.message);
        cartId = newCart.id;
      }

      // Check existing item in cart
      const existingItem = currentCart?.items.find((item) => item.product_id === productId);
      const currentQty = existingItem?.quantity || 0;
      const newQty = currentQty + quantity;

      // Validate stock
      if (newQty > product.stock_quantity) {
        toast.error(`Quantidade máxima disponível: ${product.stock_quantity}`);
        return { success: false, error: 'Insufficient stock' };
      }

      if (existingItem) {
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: newQty })
          .eq('id', existingItem.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({
            cart_id: cartId,
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
      toast.error('Não foi possível adicionar o produto ao carrinho');
      return { success: false, error: message };
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (!cart) return { success: false, error: 'No cart' };

    const item = cart.items.find((i) => i.id === itemId);
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
      toast.error('Erro ao atualizar quantidade');
      return { success: false, error: 'Erro ao atualizar quantidade' };
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
      toast.error('Erro ao remover item do carrinho');
      return { success: false, error: 'Erro ao remover item' };
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
      toast.error('Erro ao limpar carrinho');
      return { success: false, error: 'Erro ao limpar carrinho' };
    }
  };

  const getTotalItems = () => {
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const getSubtotal = () => {
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => {
      // Only count valid active items
      if (!item.product.is_active || item.product.stock_quantity <= 0) return sum;
      const price = item.product?.price || 0;
      return sum + price * item.quantity;
    }, 0);
  };

  const hasUnavailableItems = cart?.items.some(
    (item) => !item.product.is_active || item.product.stock_quantity <= 0 || item.quantity > item.product.stock_quantity
  ) || false;

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        error,
        hasUnavailableItems,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
        getTotalItems,
        getSubtotal,
        refetch: fetchCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

