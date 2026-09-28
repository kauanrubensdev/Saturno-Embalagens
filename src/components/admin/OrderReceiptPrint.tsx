import React from 'react';

export interface ReceiptItem {
  name?: string;
  product_name?: string;
  price?: number;
  product_price?: number;
  quantity: number;
  total_price?: number;
}

export interface ReceiptAddress {
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

export interface ReceiptData {
  id?: string;
  order_id?: string;
  created_at: string;
  origin?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  subtotal: number;
  shipping_cost?: number | null;
  total: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_note?: string | null;
  delivery_type?: string | null;
  pickup_address?: string | null;
  shipping_address?: ReceiptAddress | null;
  items: ReceiptItem[];
  profile?: {
    name?: string | null;
    phone?: string | null;
  } | null;
}

interface OrderReceiptPrintProps {
  order: ReceiptData | null;
  className?: string;
  isPrintOnly?: boolean;
}

export function formatReceiptCurrency(value: number | undefined | null): string {
  const val = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
}

export function formatReceiptDateTime(isoString: string | undefined | null): string {
  if (!isoString) return '--/--/---- --:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '--/--/---- --:--';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--/--/---- --:--';
  }
}

export function getReceiptPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Não informado';
  switch (method) {
    case 'cash':
      return 'Dinheiro';
    case 'pix_pos':
    case 'pix':
    case 'abacate_pix':
      return 'PIX';
    case 'debit_card':
      return 'Cartão de Débito';
    case 'credit_card':
    case 'card':
    case 'apple_pay':
    case 'google_pay':
      return 'Cartão de Crédito';
    case 'cash_on_delivery':
      return 'Dinheiro na entrega';
    case 'stripe_online':
      return 'Pagamento Online';
    case 'boleto':
      return 'Boleto Bancário';
    default:
      return method;
  }
}

export function getReceiptPaymentStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Pendente';
  switch (status) {
    case 'paid':
      return 'Pago';
    case 'pending':
      return 'Pendente';
    case 'failed':
      return 'Falhou';
    case 'cancelled':
      return 'Cancelado';
    case 'refunded':
      return 'Reembolsado';
    default:
      return status;
  }
}

export function getReceiptStatusLabel(status: string | null | undefined, deliveryType?: string | null): string {
  if (!status) return 'Pendente';
  switch (status) {
    case 'pending':
      return 'Pendente';
    case 'confirmed':
      return 'Confirmado';
    case 'preparing':
      return 'Em preparação';
    case 'shipped':
      return deliveryType === 'pickup' ? 'Pronto para Retirada' : 'Em Rota de Entrega';
    case 'delivered':
      return deliveryType === 'pickup' ? 'Retirado no Balcão' : 'Entregue';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
}

export function OrderReceiptPrint({ order, className = '', isPrintOnly = true }: OrderReceiptPrintProps) {
  if (!order) return null;

  const orderId = order.id || order.order_id || '------';
  const shortOrderId = orderId.length > 8 ? orderId.substring(0, 8).toUpperCase() : orderId.toUpperCase();
  const isPos = order.origin === 'pos';
  const orderTypeLabel = isPos ? 'Venda Presencial' : 'Pedido Online';

  const customerName =
    order.customer_name ||
    order.profile?.name ||
    (isPos ? 'Venda balcão' : 'Cliente não identificado');

  const customerPhone = order.customer_phone || order.profile?.phone || null;

  const items = order.items || [];
  const shippingCost = typeof order.shipping_cost === 'number' ? order.shipping_cost : 0;
  const isPickup = order.delivery_type === 'pickup' || isPos;

  return (
    <div
      className={`saturno-receipt-sheet-80mm ${isPrintOnly ? 'print-only' : ''} ${className}`}
      style={{
        width: '80mm',
        maxWidth: '80mm',
        boxSizing: 'border-box',
        padding: '4mm',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: "'Courier New', Courier, monospace, monospace",
        fontSize: '11px',
        lineHeight: '1.3',
      }}
    >
      {/* ── Cabeçalho do Estabelecimento ── */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '15px', letterSpacing: '0.5px' }}>
          SATURNO EMBALAGENS
        </div>
        <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '2px' }}>
          Comprovante de Venda
        </div>
        <div style={{ fontSize: '9px', color: '#333333', marginTop: '1px' }}>
          {orderTypeLabel}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />

      {/* ── Informações do Pedido e Cliente ── */}
      <div style={{ fontSize: '10.5px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Pedido:</strong> #{shortOrderId}</span>
        </div>
        <div>
          <strong>Data:</strong> {formatReceiptDateTime(order.created_at)}
        </div>

        <div style={{ marginTop: '4px' }}>
          <div><strong>Cliente:</strong> {customerName}</div>
          {customerPhone && <div><strong>Telefone:</strong> {customerPhone}</div>}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />

      {/* ── Itens do Pedido ── */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '10.5px', marginBottom: '4px', textAlign: 'center' }}>
          ITENS DO PEDIDO
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {items.map((item, idx) => {
            const name = item.product_name || item.name || 'Produto';
            const price = typeof item.product_price === 'number' ? item.product_price : (item.price || 0);
            const qty = item.quantity || 1;
            const total = typeof item.total_price === 'number' ? item.total_price : price * qty;

            return (
              <div key={idx} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <div style={{ fontWeight: 'bold', wordBreak: 'break-word', fontSize: '10.5px' }}>
                  {name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#222222' }}>
                  <span>{qty} x {formatReceiptCurrency(price)}</span>
                  <span style={{ fontWeight: 'bold', color: '#000000' }}>{formatReceiptCurrency(total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />

      {/* ── Totais ── */}
      <div style={{ fontSize: '10.5px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span>
          <span>{formatReceiptCurrency(order.subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Frete:</span>
          <span>{shippingCost > 0 ? formatReceiptCurrency(shippingCost) : 'R$ 0,00'}</span>
        </div>
        <div style={{ borderTop: '1px solid #000000', marginTop: '3px', paddingTop: '3px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
          <span>TOTAL:</span>
          <span>{formatReceiptCurrency(order.total)}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />

      {/* ── Informações de Pagamento e Entrega ── */}
      <div style={{ fontSize: '10px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Pagamento:</strong></span>
          <span>{getReceiptPaymentMethodLabel(order.payment_method)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Status Pagamento:</strong></span>
          <span>{getReceiptPaymentStatusLabel(order.payment_status)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Status Pedido:</strong></span>
          <span>{getReceiptStatusLabel(order.status, order.delivery_type)}</span>
        </div>

        {/* Local de Retirada ou Endereço de Entrega */}
        <div style={{ marginTop: '5px', paddingTop: '4px', borderTop: '1px dotted #888888' }}>
          {isPickup ? (
            <div>
              <strong>Tipo:</strong> Retirada no estabelecimento
              {order.pickup_address && (
                <div style={{ fontSize: '9.5px', color: '#333333' }}>
                  {order.pickup_address}
                </div>
              )}
            </div>
          ) : order.shipping_address ? (
            <div>
              <strong>Entrega em:</strong>
              <div style={{ fontSize: '9.5px', color: '#333333' }}>
                {order.shipping_address.street}, nº {order.shipping_address.number}
                {order.shipping_address.complement ? ` (${order.shipping_address.complement})` : ''}
                <br />
                {order.shipping_address.neighborhood} — {order.shipping_address.city}/{order.shipping_address.state}
                <br />
                CEP: {order.shipping_address.zip_code}
              </div>
            </div>
          ) : (
            <div>
              <strong>Tipo:</strong> Entrega no endereço cadastrado
            </div>
          )}
        </div>

        {/* Observações */}
        {order.customer_note && (
          <div style={{ marginTop: '5px', paddingTop: '4px', borderTop: '1px dotted #888888' }}>
            <strong>Observações:</strong>
            <div style={{ fontStyle: 'italic', fontSize: '9.5px' }}>
              {order.customer_note}
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000000', margin: '6px 0' }} />

      {/* ── Rodapé de Agradecimento ── */}
      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '6px', color: '#111111' }}>
        <div>Obrigado pela preferência!</div>
        <div style={{ fontWeight: 'bold', marginTop: '2px' }}>Saturno Embalagens</div>
      </div>
    </div>
  );
}

/**
 * Função utilitária para disparar a impressão do comprovante de 80mm
 * Configura o atributo no body para garantir que apenas o comprovante seja impresso
 */
export function printReceipt80mm() {
  document.body.setAttribute('data-print-target', 'receipt-80mm');
  window.print();
  const cleanup = () => {
    document.body.removeAttribute('data-print-target');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
}

/**
 * Função utilitária para disparar a impressão do pedido em folha A4 detalhada
 */
export function printOrderA4() {
  document.body.setAttribute('data-print-target', 'order-a4');
  window.print();
  const cleanup = () => {
    document.body.removeAttribute('data-print-target');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
}
