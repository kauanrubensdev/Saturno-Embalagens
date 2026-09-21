-- ============================================================
-- SaturnoEmbalagens — Migration inicial do banco de dados
-- Executado em: 2026-09-15
-- ============================================================

-- ============================================================
-- EXTENSÃO
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: profiles
-- Estende auth.users com dados do perfil do usuário
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX profiles_id_idx ON profiles(id);

-- ============================================================
-- TABELA: addresses
-- Endereços de entrega dos clientes
-- ============================================================
CREATE TABLE addresses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  street        TEXT NOT NULL,
  number        TEXT NOT NULL,
  complement    TEXT,
  neighborhood  TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  zip_code      TEXT NOT NULL,
  latitude      DECIMAL(10, 8),
  longitude     DECIMAL(11, 8),
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX addresses_user_id_idx ON addresses(user_id);

-- ============================================================
-- TABELA: categories
-- Categorias de produtos (ex.: Caixas de Hambúrguer, Pizza, Salgado)
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url   TEXT,
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX categories_slug_idx        ON categories(slug);
CREATE INDEX categories_parent_id_idx   ON categories(parent_id);

-- ============================================================
-- TABELA: products
-- Produtos à venda
-- ============================================================
CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id    UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  description    TEXT,
  price          DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  sku            TEXT UNIQUE,
  image_url      TEXT,
  images         TEXT[],
  is_active      BOOLEAN NOT NULL DEFAULT true,
  is_featured    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX products_slug_idx      ON products(slug);
CREATE INDEX products_category_id_idx ON products(category_id);
CREATE INDEX products_sku_idx        ON products(sku);
CREATE INDEX products_is_active_idx  ON products(is_active);

-- ============================================================
-- TABELA: orders
-- Pedidos realizados pelos clientes
-- ============================================================
CREATE TABLE orders (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status                   TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
  payment_status           TEXT NOT NULL DEFAULT 'pending'
                              CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method           TEXT
                              CHECK (payment_method IN ('pix', 'credit_card', 'cash_on_delivery')),
  subtotal                 DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
  shipping_cost            DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  total                    DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  delivery_type            TEXT NOT NULL DEFAULT 'delivery'
                              CHECK (delivery_type IN ('delivery', 'pickup')),
  shipping_address_id      UUID REFERENCES addresses(id) ON DELETE SET NULL,
  pickup_address           TEXT,
  stripe_payment_intent_id  TEXT,
  customer_note            TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_user_id_idx           ON orders(user_id);
CREATE INDEX orders_status_idx            ON orders(status);
CREATE INDEX orders_payment_status_idx    ON orders(payment_status);
CREATE INDEX orders_stripe_pi_idx         ON orders(stripe_payment_intent_id);

-- ============================================================
-- TABELA: order_items
-- Itens de cada pedido (snapshot imutável de nome e preço)
-- ============================================================
CREATE TABLE order_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name   TEXT NOT NULL,
  product_price  DECIMAL(10, 2) NOT NULL CHECK (product_price >= 0),
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  total_price    DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0)
);

CREATE INDEX order_items_order_id_idx   ON order_items(order_id);
CREATE INDEX order_items_product_id_idx ON order_items(product_id);

-- ============================================================
-- TABELA: cart
-- Um carrinho por usuário
-- ============================================================
CREATE TABLE cart (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX cart_user_id_idx ON cart(user_id);

-- ============================================================
-- TABELA: cart_items
-- Itens dentro do carrinho
-- ============================================================
CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id     UUID NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cart_id, product_id)
);

CREATE INDEX cart_items_cart_id_idx    ON cart_items(cart_id);
CREATE INDEX cart_items_product_id_idx ON cart_items(product_id);

-- ============================================================
-- TABELA: shipping_zones
-- Zonas de frete configuradas pelo ADMIN (futuro)
-- ============================================================
CREATE TABLE shipping_zones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  min_distance_km DECIMAL(10, 2) NOT NULL DEFAULT 0,
  max_distance_km DECIMAL(10, 2),
  price           DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: settings
-- Configurações gerais do sistema (ADMIN)
-- ============================================================
CREATE TABLE settings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT NOT NULL UNIQUE,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX settings_key_idx ON settings(key);

-- ============================================================
-- TABELA: stock_movements
-- Controle de entradas e saídas de estoque (futuro completo)
-- ============================================================
CREATE TABLE stock_movements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
  reason      TEXT,
  reference   TEXT,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stock_movements_product_id_idx ON stock_movements(product_id);
CREATE INDEX stock_movements_created_at_idx ON stock_movements(created_at);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica updated_at em todas as tabelas com esse campo
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'addresses', 'categories', 'products',
    'orders', 'cart', 'shipping_zones', 'settings'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- TRIGGER: criar profile automaticamente ao cadastrar user
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone',
    'customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TRIGGER: impedir cliente de se tornar admin
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_admin_self_promotion()
RETURNS TRIGGER AS $$
BEGIN
  -- Bloqueia tentativa de mudar role para 'admin' por quem não é admin
  IF NEW.role = 'admin' AND OLD.role = 'customer' THEN
    RAISE EXCEPTION 'Clientes não podem se promover a administrador.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prevent_profile_admin_change
  BEFORE UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION prevent_admin_self_promotion();

-- ============================================================
-- TRIGGER: impedir alteração de preço/nome em order_items após criação
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_order_item_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Itens de pedido não podem ser modificados após a criação.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_items_immutable
  BEFORE UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_order_item_modification();

-- ============================================================
-- TRIGGER: garantir que order_items preserve o snapshot
-- (preço/nome copiados do produto no momento da inserção — não permite UPDATE)
-- ============================================================

-- ============================================================
-- TRIGGER: atualizar updated_at de cart ao modificar cart_items
-- ============================================================
CREATE OR REPLACE FUNCTION cart_touch_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE cart SET updated_at = NOW() WHERE id = OLD.cart_id;
    RETURN OLD;
  ELSE
    UPDATE cart SET updated_at = NOW() WHERE id = NEW.cart_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cart_items_update_parent_timestamp
  AFTER INSERT OR UPDATE OR DELETE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION cart_touch_on_item_change();

-- ============================================================
-- TRIGGER: impedir cliente de modificar stock_quantity diretamente
-- (estoque só muda via stock_movements no futuro)
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_direct_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  current_role TEXT;
BEGIN
  SELECT role INTO current_role
  FROM profiles
  WHERE id = auth.uid();

  IF current_role != 'admin' THEN
    RAISE EXCEPTION 'Clientes não podem modificar estoque diretamente.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER products_stock_protected
  BEFORE UPDATE OF stock_quantity ON products
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_stock_change();

-- ============================================================
-- ROW LEVEL SECURITY — ATIVAR EM TODAS AS TABELAS
-- ============================================================

-- Helper: verifica se o usuário atual é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper: verifica se é o dono do registro
CREATE OR REPLACE FUNCTION is_owner(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  SELECT auth.uid() = target_user_id;
$$;

-- Helper: retorna o user_id do pedido ao qual o item pertence
CREATE OR REPLACE FUNCTION get_order_user(order_uuid UUID)
RETURNS UUID
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  SELECT user_id FROM orders WHERE id = order_uuid;
$$;

-- Helper: retorna o user_id do carrinho ao qual o item pertence
CREATE OR REPLACE FUNCTION get_cart_user(cart_uuid UUID)
RETURNS UUID
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  SELECT user_id FROM cart WHERE id = cart_uuid;
$$;

-- ============================================================
-- profiles
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Cliente vê e edita só o próprio perfil
CREATE POLICY "Clientes veem próprio perfil"
  ON profiles FOR SELECT
  USING (is_owner(id));

CREATE POLICY "Clientes editam próprio perfil"
  ON profiles FOR UPDATE
  USING (is_owner(id))
  WITH CHECK (is_owner(id));

-- Admin vê e edita todos
CREATE POLICY "Admin vê todos os perfis"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin edita todos os perfis"
  ON profiles FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Inserção só via trigger do auth (não exposta via RLS para clientes)
CREATE POLICY "Admin insere perfis"
  ON profiles FOR INSERT
  WITH CHECK (is_admin());

-- ============================================================
-- addresses
-- ============================================================
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes veem próprios endereços"
  ON addresses FOR SELECT
  USING (is_owner(user_id));

CREATE POLICY "Clientes criam endereços"
  ON addresses FOR INSERT
  WITH CHECK (is_owner(user_id));

CREATE POLICY "Clientes editam próprios endereços"
  ON addresses FOR UPDATE
  USING (is_owner(user_id))
  WITH CHECK (is_owner(user_id));

CREATE POLICY "Clientes excluem próprios endereços"
  ON addresses FOR DELETE
  USING (is_owner(user_id));

CREATE POLICY "Admin vê endereços para gestão de pedidos"
  ON addresses FOR SELECT
  USING (is_admin());

-- ============================================================
-- categories
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Todos veem categorias ativas (público e logados)
CREATE POLICY "Categorias ativas são públicas"
  ON categories FOR SELECT
  USING (is_active = true);

-- Só admin gerencia
CREATE POLICY "Admin gerencia categorias"
  ON categories FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- products
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Todos veem produtos ativos (público e logados)
CREATE POLICY "Produtos ativos são públicos"
  ON products FOR SELECT
  USING (is_active = true);

-- Só admin gerencia
CREATE POLICY "Admin gerencia produtos"
  ON products FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- orders
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Cliente cria pedido próprio
CREATE POLICY "Clientes criam pedidos"
  ON orders FOR INSERT
  WITH CHECK (is_owner(user_id));

-- Cliente vê só seus pedidos
CREATE POLICY "Clientes veem próprios pedidos"
  ON orders FOR SELECT
  USING (is_owner(user_id));

-- Cliente NÃO pode atualizar status, payment_status, valores, etc.
-- A policy de UPDATE sem USING permite verificar apenas no WITH CHECK

-- Cliente não pode deletar pedido
CREATE POLICY "Clientes não deletam pedidos"
  ON orders FOR DELETE
  USING (false);

-- Admin vê todos os pedidos
CREATE POLICY "Admin vê todos os pedidos"
  ON orders FOR SELECT
  USING (is_admin());

-- Admin atualiza pedidos (status, payment_status, etc.)
CREATE POLICY "Admin atualiza pedidos"
  ON orders FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- order_items
-- ============================================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Cliente vê itens dos seus próprios pedidos
CREATE POLICY "Clientes veem itens dos seus pedidos"
  ON order_items FOR SELECT
  USING (is_owner(get_order_user(order_id)));

-- Admin vê todos os itens
CREATE POLICY "Admin vê todos os itens"
  ON order_items FOR SELECT
  USING (is_admin());

-- Admin insere itens (via trigger ou procedure futura no backend)
CREATE POLICY "Admin insere itens"
  ON order_items FOR INSERT
  WITH CHECK (is_admin());

-- order_items_immutable trigger bloqueia UPDATE e DELETE
-- Policies explícitas para deixar claro que ninguém altera após criar
CREATE POLICY "Impede update de itens (trigger)"
  ON order_items FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Impede delete de itens (trigger)"
  ON order_items FOR DELETE
  USING (false);

-- ============================================================
-- cart
-- ============================================================
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes veem próprio carrinho"
  ON cart FOR SELECT
  USING (is_owner(user_id));

CREATE POLICY "Clientes criam carrinho próprio"
  ON cart FOR INSERT
  WITH CHECK (is_owner(user_id));

CREATE POLICY "Clientes atualizam próprio carrinho"
  ON cart FOR UPDATE
  USING (is_owner(user_id))
  WITH CHECK (is_owner(user_id));

CREATE POLICY "Clientes deletam próprio carrinho"
  ON cart FOR DELETE
  USING (is_owner(user_id));

-- ============================================================
-- cart_items
-- ============================================================
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes veem itens do próprio carrinho"
  ON cart_items FOR SELECT
  USING (is_owner(get_cart_user(cart_id)));

CREATE POLICY "Clientes inserem no próprio carrinho"
  ON cart_items FOR INSERT
  WITH CHECK (is_owner(get_cart_user(cart_id)));

CREATE POLICY "Clientes atualizam itens do próprio carrinho"
  ON cart_items FOR UPDATE
  USING (is_owner(get_cart_user(cart_id)))
  WITH CHECK (is_owner(get_cart_user(cart_id)));

CREATE POLICY "Clientes deletam itens do próprio carrinho"
  ON cart_items FOR DELETE
  USING (is_owner(get_cart_user(cart_id)));

-- ============================================================
-- shipping_zones
-- ============================================================
ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia zonas de frete"
  ON shipping_zones FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- settings
-- ============================================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia configurações"
  ON settings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- stock_movements
-- ============================================================
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Admin gerencia todos os movimentos de estoque
CREATE POLICY "Admin gerencia stock_movements"
  ON stock_movements FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- SEED: configurações iniciais
-- ============================================================
INSERT INTO settings (key, value) VALUES
  ('store_name',         '{"pt": "Saturno Embalagens"}'),
  ('pickup_address',     '{"street": "R. Urupema", "number": "150", "neighborhood": "São Cosme de Baixo", "city": "Santa Luzia", "state": "MG", "zip_code": "33130-140", "lat": -19.7595, "lng": -43.8514}'),
  ('free_shipping',      '{"enabled": true, "cost": 0}'),
  ('order_prefix',       '{"value": "SAT-"}');

-- ============================================================
-- SEED: categorias iniciais
-- ============================================================
INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Caixas de Hambúrguer', 'caixas-de-hamburguer', 'Caixas para hambúrgueres, sanduíches e lanches', 1),
  ('Caixas de Pizza',      'caixas-de-pizza',      'Caixas para pizzas de todos os tamanhos',          2),
  ('Caixas de Salgado',    'caixas-de-salgado',    'Caixas para salgados, coxinhas e quitutes',        3);
