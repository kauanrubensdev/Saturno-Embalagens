import { toast } from 'sonner';

export interface PrintReceiptItem {
  name?: string;
  product_name?: string;
  price?: number;
  product_price?: number;
  quantity: number;
  total_price?: number;
}

export interface PrintReceiptAddress {
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

export interface PrintReceiptData {
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
  shipping_address?: PrintReceiptAddress | null;
  items?: PrintReceiptItem[];
  order_items?: PrintReceiptItem[];
  profile?: {
    name?: string | null;
    phone?: string | null;
  } | null;
}

// ─── Format Helpers ──────────────────────────────────────────────────────────

export function formatCurrencyBRL(value: number | undefined | null): string {
  const val = typeof value === 'number' && !isNaN(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val);
}

export function formatDateTimeBRL(isoString: string | undefined | null): string {
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

export function getPaymentMethodFriendlyName(method: string | null | undefined): string {
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

export function getPaymentStatusFriendlyName(status: string | null | undefined): string {
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

export function getOrderStatusFriendlyName(status: string | null | undefined, deliveryType?: string | null): string {
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

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── 80mm Thermal Receipt Generator ──────────────────────────────────────────

export function generateReceipt80mmHtml(order: PrintReceiptData): string {
  const orderId = order.id || order.order_id || '------';
  const shortId = orderId.length > 8 ? orderId.substring(0, 8).toUpperCase() : orderId.toUpperCase();
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

  const itemsHtml = items.map((item) => {
    const name = escapeHtml(item.product_name || item.name || 'Produto');
    const price = typeof item.product_price === 'number' ? item.product_price : (item.price || 0);
    const qty = item.quantity || 1;
    const total = typeof item.total_price === 'number' ? item.total_price : price * qty;

    return `
      <div class="item-block">
        <div class="item-name">${name}</div>
        <div class="item-calc">
          <span>${qty} x ${formatCurrencyBRL(price)}</span>
          <span style="font-weight: bold; color: #000000;">${formatCurrencyBRL(total)}</span>
        </div>
      </div>
    `;
  }).join('');

  let deliveryInfoHtml = '';
  if (isPickup) {
    deliveryInfoHtml = `
      <div style="margin-top: 4px;">
        <strong>Tipo:</strong> Retirada no estabelecimento
        ${order.pickup_address ? `<div style="font-size: 9.5px; color: #333;">${escapeHtml(order.pickup_address)}</div>` : ''}
      </div>
    `;
  } else if (order.shipping_address) {
    const addr = order.shipping_address;
    deliveryInfoHtml = `
      <div style="margin-top: 4px;">
        <strong>Entrega em:</strong>
        <div style="font-size: 9.5px; color: #333; line-height: 1.25;">
          ${escapeHtml(addr.street)}, nº ${escapeHtml(addr.number)}${addr.complement ? ` (${escapeHtml(addr.complement)})` : ''}<br>
          ${escapeHtml(addr.neighborhood)} — ${escapeHtml(addr.city)}/${escapeHtml(addr.state)}<br>
          CEP: ${escapeHtml(addr.zip_code)}
        </div>
      </div>
    `;
  } else {
    deliveryInfoHtml = `
      <div style="margin-top: 4px;">
        <strong>Tipo:</strong> Entrega no endereço cadastrado
      </div>
    `;
  }

  const noteHtml = order.customer_note ? `
    <div style="margin-top: 4px; padding-top: 3px; border-top: 1px dotted #888;">
      <strong>Observações:</strong>
      <div style="font-style: italic; font-size: 9.5px;">${escapeHtml(order.customer_note)}</div>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprovante #${shortId}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .receipt {
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 4mm;
      box-sizing: border-box;
      background: #ffffff;
      color: #000000;
    }
    .header {
      text-align: center;
      margin-bottom: 6px;
    }
    .company-title {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .receipt-title {
      font-size: 11px;
      font-weight: 700;
      margin-top: 2px;
    }
    .receipt-subtitle {
      font-size: 9.5px;
      color: #333333;
      margin-top: 1px;
    }
    .divider {
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }
    .solid-divider {
      border-top: 1px solid #000000;
      margin: 3px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .item-block {
      margin-bottom: 5px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .item-name {
      font-weight: 700;
      font-size: 10.5px;
      word-break: break-word;
    }
    .item-calc {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #222222;
      margin-top: 1px;
    }
    .total-row {
      font-size: 12.5px;
      font-weight: 800;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 8px;
    }
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      html, body {
        width: 80mm;
        margin: 0;
        padding: 0;
      }
      .receipt {
        width: 72mm;
        max-width: 72mm;
        margin: 0 auto;
        padding: 3mm 4mm;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Cabeçalho -->
    <div class="header">
      <div class="company-title">SATURNO EMBALAGENS</div>
      <div class="receipt-title">Comprovante de Venda</div>
      <div class="receipt-subtitle">${escapeHtml(orderTypeLabel)}</div>
    </div>

    <div class="divider"></div>

    <!-- Info Pedido / Cliente -->
    <div style="font-size: 10.5px; margin-bottom: 4px;">
      <div class="row">
        <span><strong>Pedido:</strong> #${shortId}</span>
      </div>
      <div><strong>Data:</strong> ${formatDateTimeBRL(order.created_at)}</div>
      <div style="margin-top: 3px;">
        <div><strong>Cliente:</strong> ${escapeHtml(customerName)}</div>
        ${customerPhone ? `<div><strong>Telefone:</strong> ${escapeHtml(customerPhone)}</div>` : ''}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Itens -->
    <div style="margin-bottom: 4px;">
      <div style="font-weight: 800; font-size: 10.5px; text-align: center; margin-bottom: 4px;">
        ITENS DO PEDIDO
      </div>
      ${itemsHtml || '<div style="font-style: italic; text-align: center; font-size: 10px;">Nenhum item</div>'}
    </div>

    <div class="divider"></div>

    <!-- Totais -->
    <div style="font-size: 10.5px; margin-bottom: 4px;">
      <div class="row">
        <span>Subtotal:</span>
        <span>${formatCurrencyBRL(order.subtotal)}</span>
      </div>
      <div class="row">
        <span>Frete:</span>
        <span>${shippingCost > 0 ? formatCurrencyBRL(shippingCost) : 'R$ 0,00'}</span>
      </div>
      <div class="solid-divider"></div>
      <div class="row total-row">
        <span>TOTAL:</span>
        <span>${formatCurrencyBRL(order.total)}</span>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Pagamento & Entrega -->
    <div style="font-size: 10px; margin-bottom: 4px;">
      <div class="row">
        <span><strong>Pagamento:</strong></span>
        <span>${escapeHtml(getPaymentMethodFriendlyName(order.payment_method))}</span>
      </div>
      <div class="row">
        <span><strong>Status Pagamento:</strong></span>
        <span>${escapeHtml(getPaymentStatusFriendlyName(order.payment_status))}</span>
      </div>
      <div class="row">
        <span><strong>Status Pedido:</strong></span>
        <span>${escapeHtml(getOrderStatusFriendlyName(order.status, order.delivery_type))}</span>
      </div>
      ${deliveryInfoHtml}
      ${noteHtml}
    </div>

    <div class="divider"></div>

    <!-- Rodapé -->
    <div class="footer">
      <div>Obrigado pela preferência!</div>
      <div style="font-weight: bold; margin-top: 2px;">Saturno Embalagens</div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Detailed A4 Document Generator ──────────────────────────────────────────

export function generateOrderA4Html(order: PrintReceiptData): string {
  const orderId = order.id || order.order_id || '------';
  const shortId = orderId.length > 8 ? orderId.substring(0, 8).toUpperCase() : orderId.toUpperCase();
  const isPos = order.origin === 'pos';

  const customerName =
    order.customer_name ||
    order.profile?.name ||
    (isPos ? 'Venda balcão' : 'Cliente não identificado');

  const customerPhone = order.customer_phone || order.profile?.phone || 'Não informado';
  const items = order.items || order.order_items || [];
  const shippingCost = typeof order.shipping_cost === 'number' ? order.shipping_cost : 0;
  const isPickup = order.delivery_type === 'pickup' || isPos;

  const itemsRowsHtml = items.map((item, idx) => {
    const name = escapeHtml(item.product_name || item.name || 'Produto');
    const price = typeof item.product_price === 'number' ? item.product_price : (item.price || 0);
    const qty = item.quantity || 1;
    const total = typeof item.total_price === 'number' ? item.total_price : price * qty;

    return `
      <tr class="item-row">
        <td style="text-align: center; color: #555;">${idx + 1}</td>
        <td style="font-weight: 600; color: #111;">${name}</td>
        <td style="text-align: center; font-weight: bold;">${qty}</td>
        <td style="text-align: right;">${formatCurrencyBRL(price)}</td>
        <td style="text-align: right; font-weight: bold;">${formatCurrencyBRL(total)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedido A4 #${shortId}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .sheet {
      width: 190mm;
      max-width: 190mm;
      margin: 0 auto;
      padding: 10mm 5mm;
      background: #ffffff;
      color: #000000;
    }
    .header {
      border-bottom: 2px solid #000000;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header p {
      font-size: 11px;
      font-weight: 600;
      color: #555555;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
      font-size: 11px;
    }
    .header-meta .order-number {
      font-size: 15px;
      font-weight: 900;
      color: #000000;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 16px;
    }
    .card {
      border: 1px solid #cccccc;
      border-radius: 4px;
      padding: 10px;
      background: #fafafa;
      break-inside: avoid;
    }
    .card-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #333333;
      border-bottom: 1px solid #cccccc;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
      margin-bottom: 16px;
      border: 1px solid #cccccc;
    }
    table.items-table th {
      background: #f0f0f0;
      border-bottom: 1px solid #cccccc;
      padding: 6px 8px;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 10px;
      color: #333333;
    }
    table.items-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e5e5e5;
    }
    .totals-box {
      border: 1px solid #cccccc;
      border-radius: 4px;
      padding: 10px;
      background: #fafafa;
      font-size: 11.5px;
      break-inside: avoid;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .grand-total {
      border-top: 1px solid #888888;
      padding-top: 6px;
      margin-top: 6px;
      font-size: 14px;
      font-weight: 900;
    }
    .signatures {
      border-top: 2px dashed #888888;
      padding-top: 16px;
      margin-top: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      font-size: 11px;
      break-inside: avoid;
    }
    .signature-line {
      border-bottom: 1px solid #000000;
      margin-top: 24px;
    }
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    @media print {
      html, body {
        width: 100%;
        margin: 0;
        padding: 0;
      }
      .sheet {
        width: 100%;
        max-width: 100%;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <h1>SATURNO EMBALAGENS</h1>
        <p>Comprovante de Separação e Entrega</p>
      </div>
      <div class="header-meta">
        <div class="order-number">Pedido: #${shortId}</div>
        <div>Data/Hora: ${formatDateTimeBRL(order.created_at)}</div>
        <div>Status: <strong>${escapeHtml(getOrderStatusFriendlyName(order.status, order.delivery_type))}</strong></div>
        <div>Pagamento: <strong>${escapeHtml(getPaymentStatusFriendlyName(order.payment_status))}</strong></div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Cliente -->
      <div class="card">
        <div class="card-title">Dados do Cliente</div>
        <div style="font-size: 11.5px; line-height: 1.5;">
          <div><strong>Nome:</strong> ${escapeHtml(customerName)}</div>
          <div><strong>Telefone:</strong> ${escapeHtml(customerPhone)}</div>
        </div>
      </div>

      <!-- Entrega / Retirada -->
      <div class="card">
        <div class="card-title">${isPickup ? 'Retirada no Estabelecimento' : 'Endereço de Entrega'}</div>
        <div style="font-size: 11.5px; line-height: 1.5;">
          <div><strong>Tipo:</strong> ${isPickup ? 'RETIRADA NO BALCÃO' : 'ENTREGA'}</div>
          ${
            !isPickup && order.shipping_address
              ? `<div>
                  ${escapeHtml(order.shipping_address.street)}, nº ${escapeHtml(order.shipping_address.number)}${order.shipping_address.complement ? ` (${escapeHtml(order.shipping_address.complement)})` : ''}<br>
                  ${escapeHtml(order.shipping_address.neighborhood)} — ${escapeHtml(order.shipping_address.city)}/${escapeHtml(order.shipping_address.state)}<br>
                  CEP: ${escapeHtml(order.shipping_address.zip_code)}
                </div>`
              : `<div>${escapeHtml(order.pickup_address || 'Galpão Saturno Embalagens')}</div>`
          }
        </div>
      </div>
    </div>

    <!-- Tabela de Itens -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">#</th>
          <th style="text-align: left;">Produto / Descrição</th>
          <th style="width: 50px; text-align: center;">Qtd</th>
          <th style="width: 90px; text-align: right;">Unitário</th>
          <th style="width: 90px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 12px; color: #888;">Nenhum item listado.</td></tr>'}
      </tbody>
    </table>

    <div class="grid-2">
      <!-- Pagamento -->
      <div class="card">
        <div class="card-title">Informações de Pagamento</div>
        <div style="font-size: 11.5px; line-height: 1.6;">
          <div><strong>Método:</strong> ${escapeHtml(getPaymentMethodFriendlyName(order.payment_method))}</div>
          <div><strong>Status:</strong> ${escapeHtml(getPaymentStatusFriendlyName(order.payment_status))}</div>
          <div><strong>Origem:</strong> ${isPos ? 'PDV (Venda Presencial)' : 'E-commerce (Loja Online)'}</div>
        </div>
      </div>

      <!-- Resumo Financeiro -->
      <div class="totals-box">
        <div class="card-title">Resumo Financeiro</div>
        <div class="totals-row">
          <span>Subtotal:</span>
          <span>${formatCurrencyBRL(order.subtotal)}</span>
        </div>
        <div class="totals-row">
          <span>Frete:</span>
          <span>${shippingCost > 0 ? formatCurrencyBRL(shippingCost) : 'Grátis (R$ 0,00)'}</span>
        </div>
        <div class="totals-row grand-total">
          <span>TOTAL DO PEDIDO:</span>
          <span>${formatCurrencyBRL(order.total)}</span>
        </div>
      </div>
    </div>

    ${
      order.customer_note
        ? `<div class="card" style="margin-bottom: 16px;">
            <div class="card-title">Observações do Pedido</div>
            <p style="font-size: 11px; white-space: pre-line;">${escapeHtml(order.customer_note)}</p>
          </div>`
        : ''
    }

    <div class="signatures">
      <div>
        <p style="color: #444;">Assinatura do Recebedor:</p>
        <div class="signature-line"></div>
      </div>
      <div>
        <p style="color: #444;">Data de Entrega:</p>
        <p style="margin-top: 18px; font-family: monospace; font-size: 13px; letter-spacing: 2px;">____ / ____ / ________</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Window Printer Launcher ─────────────────────────────────────────────────

export function printIsolatedWindow(htmlContent: string, windowTitle = 'Imprimir'): boolean {
  try {
    const printWindow = window.open('', '_blank', 'width=520,height=750,menubar=no,toolbar=no,location=no,status=no');

    if (!printWindow) {
      toast.error('Permita pop-ups no navegador para imprimir o comprovante.');
      return false;
    }

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    const doPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (err) {
        console.error('Erro ao acionar print():', err);
      }
    };

    if (printWindow.document.readyState === 'complete') {
      setTimeout(doPrint, 150);
    } else {
      printWindow.onload = () => {
        setTimeout(doPrint, 150);
      };
    }

    return true;
  } catch (err) {
    console.error('Falha ao abrir janela de impressão:', err);
    toast.error('Não foi possível abrir a janela de impressão.');
    return false;
  }
}

/**
 * Imprime o comprovante de venda de 80mm em janela 100% isolada
 */
export function printReceipt(order: PrintReceiptData): boolean {
  if (!order) {
    toast.error('Dados do pedido indisponíveis para impressão.');
    return false;
  }
  const html = generateReceipt80mmHtml(order);
  return printIsolatedWindow(html, 'Comprovante');
}

/**
 * Imprime o pedido detalhado em A4 em janela 100% isolada
 */
export function printOrderA4(order: PrintReceiptData): boolean {
  if (!order) {
    toast.error('Dados do pedido indisponíveis para impressão.');
    return false;
  }
  const html = generateOrderA4Html(order);
  return printIsolatedWindow(html, 'Pedido A4');
}
