import React from 'react';
import {
  PrintReceiptData,
  PrintReceiptItem,
  formatCurrencyBRL,
  formatDateTimeBRL,
  getPaymentMethodFriendlyName,
  getPaymentStatusFriendlyName,
  getOrderStatusFriendlyName,
  printReceipt,
  printOrderA4,
} from '@/lib/printReceipt';

export type { PrintReceiptData as ReceiptData, PrintReceiptItem as ReceiptItem };
export { printReceipt, printOrderA4, formatCurrencyBRL as formatReceiptCurrency, formatDateTimeBRL as formatReceiptDateTime };

interface OrderReceiptPrintProps {
  order: PrintReceiptData | null;
  className?: string;
  isPrintOnly?: boolean;
}

/**
 * Componente visual de prévia do comprovante térmico de 80mm para exibição em tela (modais/detalhes).
 * A impressão real é realizada via popup isolado através de printReceipt(order).
 */
export function OrderReceiptPrint({ order, className = '', isPrintOnly = false }: OrderReceiptPrintProps) {
  if (!order || isPrintOnly) return null;

  const orderId = order.id || order.order_id || '------';
  const shortOrderId = orderId.length > 8 ? orderId.substring(0, 8).toUpperCase() : orderId.toUpperCase();
  const isPos = order.origin === 'pos';
  const orderTypeLabel = isPos ? 'Venda Presencial' : 'Pedido Online';

  const customerName =
    order.customer_name ||
    order.profile?.name ||
    (isPos ? 'Venda balcão' : 'Cliente não identificado');

  const customerPhone = order.customer_phone || order.profile?.phone || null;
  const items = order.items || order.order_items || [];
  const shippingCost = typeof order.shipping_cost === 'number' ? order.shipping_cost : 0;
  const isPickup = order.delivery_type === 'pickup' || isPos;

  return (
    <div
      className={`receipt-preview-card ${className}`}
      style={{
        width: '320px',
        maxWidth: '100%',
        boxSizing: 'border-box',
        padding: '16px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: "'Courier New', Courier, monospace, monospace",
        fontSize: '11px',
        lineHeight: '1.35',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e5e5',
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
        <div style={{ fontSize: '9.5px', color: '#444444', marginTop: '1px' }}>
          {orderTypeLabel}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

      {/* ── Informações do Pedido e Cliente ── */}
      <div style={{ fontSize: '10.5px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Pedido:</strong> #{shortOrderId}</span>
        </div>
        <div>
          <strong>Data:</strong> {formatDateTimeBRL(order.created_at)}
        </div>

        <div style={{ marginTop: '4px' }}>
          <div><strong>Cliente:</strong> {customerName}</div>
          {customerPhone && <div><strong>Telefone:</strong> {customerPhone}</div>}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

      {/* ── Itens do Pedido ── */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '10.5px', marginBottom: '6px', textAlign: 'center' }}>
          ITENS DO PEDIDO
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map((item, idx) => {
            const name = item.product_name || item.name || 'Produto';
            const price = typeof item.product_price === 'number' ? item.product_price : (item.price || 0);
            const qty = item.quantity || 1;
            const total = typeof item.total_price === 'number' ? item.total_price : price * qty;

            return (
              <div key={idx}>
                <div style={{ fontWeight: 'bold', wordBreak: 'break-word', fontSize: '10.5px' }}>
                  {name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#222222' }}>
                  <span>{qty} x {formatCurrencyBRL(price)}</span>
                  <span style={{ fontWeight: 'bold', color: '#000000' }}>{formatCurrencyBRL(total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

      {/* ── Totais ── */}
      <div style={{ fontSize: '10.5px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span>
          <span>{formatCurrencyBRL(order.subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Frete:</span>
          <span>{shippingCost > 0 ? formatCurrencyBRL(shippingCost) : 'R$ 0,00'}</span>
        </div>
        <div style={{ borderTop: '1px solid #000000', marginTop: '4px', paddingTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
          <span>TOTAL:</span>
          <span>{formatCurrencyBRL(order.total)}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

      {/* ── Informações de Pagamento e Entrega ── */}
      <div style={{ fontSize: '10px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Pagamento:</strong></span>
          <span>{getPaymentMethodFriendlyName(order.payment_method)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Status Pagamento:</strong></span>
          <span>{getPaymentStatusFriendlyName(order.payment_status)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><strong>Status Pedido:</strong></span>
          <span>{getOrderStatusFriendlyName(order.status, order.delivery_type)}</span>
        </div>

        {/* Local de Retirada ou Endereço de Entrega */}
        <div style={{ marginTop: '5px', paddingTop: '4px', borderTop: '1px dotted #888888' }}>
          {isPickup ? (
            <div>
              <strong>Tipo:</strong> Retirada no estabelecimento
              {order.pickup_address && (
                <div style={{ fontSize: '9.5px', color: '#444444' }}>
                  {order.pickup_address}
                </div>
              )}
            </div>
          ) : order.shipping_address ? (
            <div>
              <strong>Entrega em:</strong>
              <div style={{ fontSize: '9.5px', color: '#444444' }}>
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

      <div style={{ borderTop: '1px dashed #000000', margin: '8px 0' }} />

      {/* ── Rodapé de Agradecimento ── */}
      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '6px', color: '#222222' }}>
        <div>Obrigado pela preferência!</div>
        <div style={{ fontWeight: 'bold', marginTop: '2px' }}>Saturno Embalagens</div>
      </div>
    </div>
  );
}
