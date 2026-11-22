// supabase/functions/send-order-email/templates.ts
import { RenderTemplateParams, RenderedEmail, EmailType } from './types.ts';

function formatBRL(value: number): string {
  const num = typeof value === 'number' && !isNaN(value) ? value : 0;
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPaymentMethodLabel(method: string | null): string {
  if (!method) return 'A definir';
  const clean = method.toLowerCase();
  if (clean.includes('pix')) return 'PIX';
  if (clean.includes('card') || clean.includes('credit') || clean.includes('stripe')) return 'Cartão de Crédito';
  if (clean.includes('money') || clean.includes('cash') || clean.includes('dinheiro')) return 'Dinheiro';
  if (clean.includes('boleto')) return 'Boleto Bancário';
  return method;
}

interface TypeConfig {
  badgeText: string;
  badgeBg: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  subjectPrefix: string;
}

function getTypeConfig(emailType: EmailType, shortId: string): TypeConfig {
  switch (emailType) {
    case 'order_created':
      return {
        badgeText: 'Pedido Recebido',
        badgeBg: '#FE5516',
        badgeColor: '#FFFFFF',
        title: 'Recebemos o seu pedido!',
        subtitle: `Obrigado por comprar na Saturno Embalagens. Seu pedido <strong>#${shortId}</strong> foi registrado com sucesso.`,
        subjectPrefix: `Pedido #${shortId} recebido com sucesso`,
      };
    case 'payment_approved':
      return {
        badgeText: 'Pagamento Aprovado',
        badgeBg: '#22C55E',
        badgeColor: '#FFFFFF',
        title: 'Pagamento confirmado!',
        subtitle: `O pagamento do seu pedido <strong>#${shortId}</strong> foi aprovado. Vamos iniciar a separação!`,
        subjectPrefix: `Pagamento aprovado para o Pedido #${shortId}`,
      };
    case 'preparing':
      return {
        badgeText: 'Em Separação',
        badgeBg: '#38BDF8',
        badgeColor: '#001621',
        title: 'Seu pedido está sendo preparado!',
        subtitle: `Nossa equipe já está separando e conferindo os itens do seu pedido <strong>#${shortId}</strong>.`,
        subjectPrefix: `Seu Pedido #${shortId} está em separação`,
      };
    case 'ready_for_pickup':
      return {
        badgeText: 'Pronto para Retirada',
        badgeBg: '#A855F7',
        badgeColor: '#FFFFFF',
        title: 'Seu pedido está pronto para retirada!',
        subtitle: `Tudo pronto! Você já pode retirar seu pedido <strong>#${shortId}</strong> em nossa loja física.`,
        subjectPrefix: `Seu Pedido #${shortId} está pronto para retirada!`,
      };
    case 'shipped':
      return {
        badgeText: 'Saiu para Entrega',
        badgeBg: '#0EA5E9',
        badgeColor: '#FFFFFF',
        title: 'Seu pedido saiu para entrega!',
        subtitle: `Os produtos do seu pedido <strong>#${shortId}</strong> estão a caminho do seu endereço.`,
        subjectPrefix: `Seu Pedido #${shortId} saiu para entrega!`,
      };
    case 'delivered':
      return {
        badgeText: 'Pedido Entregue',
        badgeBg: '#22C55E',
        badgeColor: '#FFFFFF',
        title: 'Pedido entregue com sucesso!',
        subtitle: `Seu pedido <strong>#${shortId}</strong> foi entregue. Esperamos que goste da qualidade das nossas embalagens!`,
        subjectPrefix: `Seu Pedido #${shortId} foi entregue!`,
      };
    case 'cancelled':
      return {
        badgeText: 'Pedido Cancelado',
        badgeBg: '#EF4444',
        badgeColor: '#FFFFFF',
        title: 'Pedido cancelado',
        subtitle: `O pedido <strong>#${shortId}</strong> foi cancelado. Se tiver dúvidas, nossa equipe está à disposição.`,
        subjectPrefix: `Atualização: Pedido #${shortId} cancelado`,
      };
    default:
      return {
        badgeText: 'Atualização do Pedido',
        badgeBg: '#FE5516',
        badgeColor: '#FFFFFF',
        title: 'Atualização do seu pedido',
        subtitle: `Temos uma atualização sobre o seu pedido <strong>#${shortId}</strong>.`,
        subjectPrefix: `Atualização do Pedido #${shortId}`,
      };
  }
}

export function renderEmailTemplate(params: RenderTemplateParams): RenderedEmail {
  const { order, items, address, customerName, emailType, shortOrderId, formattedDate } = params;
  const config = getTypeConfig(emailType, shortOrderId);
  const subject = `${config.subjectPrefix} - Saturno Embalagens`;

  // Detalhes da Entrega ou Retirada
  const isPickup = order.delivery_type === 'pickup';
  const deliveryLabel = isPickup ? 'Retirada na Loja' : 'Entrega no Endereço';
  let deliveryDetailsHtml = '';

  if (isPickup) {
    // Preserva endereço de retirada customizado se existir no pedido, senão utiliza o endereço padrão com CEP corrigido 33130-140
    const pickupAddress = order.pickup_address?.trim() || 'Rua Urupema, nº 150, São Cosme de Baixo - Santa Luzia / MG, CEP 33130-140';
    deliveryDetailsHtml = `
      <p style="margin: 0 0 6px 0; color: #FFFFFF; font-weight: 600; font-size: 14px;">Local de Retirada:</p>
      <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">${escapeHtml(pickupAddress)}</p>
    `;
  } else if (address) {
    const complementText = address.complement ? ` - ${escapeHtml(address.complement)}` : '';
    deliveryDetailsHtml = `
      <p style="margin: 0 0 6px 0; color: #FFFFFF; font-weight: 600; font-size: 14px;">Endereço de Entrega:</p>
      <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.5;">
        ${escapeHtml(address.street)}, nº ${escapeHtml(address.number)}${complementText}<br/>
        ${escapeHtml(address.neighborhood)} - ${escapeHtml(address.city)} / ${escapeHtml(address.state)}<br/>
        CEP: ${escapeHtml(address.zip_code)}
      </p>
    `;
  } else {
    deliveryDetailsHtml = `
      <p style="margin: 0; color: #cbd5e1; font-size: 13px;">Endereço registrado na finalização da compra.</p>
    `;
  }

  // Itens Comprados (tabela segura)
  const itemsRowsHtml = items
    .map((item, idx) => {
      const bg = idx % 2 === 0 ? '#001621' : '#032030';
      return `
        <tr style="background-color: ${bg}; border-bottom: 1px solid #13384c;">
          <td style="padding: 12px 14px; color: #FFFFFF; font-size: 13px; font-weight: 500; vertical-align: middle;">
            ${escapeHtml(item.product_name)}
          </td>
          <td style="padding: 12px 10px; color: #cbd5e1; font-size: 13px; text-align: center; vertical-align: middle;">
            ${item.quantity}
          </td>
          <td style="padding: 12px 10px; color: #cbd5e1; font-size: 13px; text-align: right; vertical-align: middle;">
            ${formatBRL(item.product_price)}
          </td>
          <td style="padding: 12px 14px; color: #FE5516; font-size: 13px; font-weight: 600; text-align: right; vertical-align: middle;">
            ${formatBRL(item.total_price)}
          </td>
        </tr>
      `;
    })
    .join('');

  const shippingCostDisplay = isPickup
    ? 'Grátis (Retirada)'
    : order.shipping_cost > 0
    ? formatBRL(order.shipping_cost)
    : 'Grátis';

  const paymentMethodLabel = getPaymentMethodLabel(order.payment_method);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #000e16;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #FFFFFF;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-collapse: collapse;
    }
    a {
      color: #FE5516;
      text-decoration: none;
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #000e16;">
  <!-- Container Principal -->
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; width: 100%; background-color: #001621; border-radius: 12px; overflow: hidden; border: 1px solid #13384c; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
          
          <!-- Faixa Laranja de Destaque Superior -->
          <tr>
            <td style="height: 5px; background: #FE5516;"></td>
          </tr>

          <!-- Header com Logo da Marca -->
          <tr>
            <td style="padding: 24px 28px 20px 28px; background-color: #001621; border-bottom: 1px solid #13384c;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2;">
                      <span style="color: #FE5516;">Saturno</span><span style="color: #FFFFFF; margin-left: 4px;">Embalagens</span>
                    </div>
                    <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">
                      Embalagens de qualidade para delivery
                    </div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: ${config.badgeBg}; color: ${config.badgeColor};">
                      ${escapeHtml(config.badgeText)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero / Mensagem de Status -->
          <tr>
            <td style="padding: 28px 28px 20px 28px;">
              <p style="margin: 0 0 8px 0; color: #FE5516; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">
                Olá, ${escapeHtml(customerName)}!
              </p>
              <h1 style="margin: 0 0 12px 0; color: #FFFFFF; font-size: 20px; font-weight: 700; line-height: 1.3;">
                ${escapeHtml(config.title)}
              </h1>
              <p style="margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.6;">
                ${config.subtitle}
              </p>
            </td>
          </tr>

          <!-- Caixa de Resumo do Pedido -->
          <tr>
            <td style="padding: 0 28px 20px 28px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #061d2a; border-radius: 8px; border: 1px solid #13384c;">
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #13384c;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: 600;">
                          Código do Pedido
                        </td>
                        <td align="right" style="color: #FFFFFF; font-size: 13px; font-weight: 700; font-family: monospace;">
                          #${escapeHtml(shortOrderId)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #13384c;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: 600;">
                          Data da Compra
                        </td>
                        <td align="right" style="color: #cbd5e1; font-size: 13px;">
                          ${escapeHtml(formattedDate)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #13384c;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: 600;">
                          Método de Pagamento
                        </td>
                        <td align="right" style="color: #cbd5e1; font-size: 13px; font-weight: 600;">
                          ${escapeHtml(paymentMethodLabel)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 18px;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="color: #94a3b8; font-size: 12px; text-transform: uppercase; font-weight: 600;">
                          Modalidade
                        </td>
                        <td align="right" style="color: #cbd5e1; font-size: 13px; font-weight: 600;">
                          ${escapeHtml(deliveryLabel)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabela de Itens Comprados -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <h2 style="margin: 0 0 12px 0; color: #FFFFFF; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                Itens do Pedido
              </h2>
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-radius: 8px; overflow: hidden; border: 1px solid #13384c;">
                <thead>
                  <tr style="background-color: #061d2a; border-bottom: 1px solid #13384c;">
                    <th align="left" style="padding: 10px 14px; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 700;">Produto</th>
                    <th align="center" style="padding: 10px 10px; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 700;">Qtd</th>
                    <th align="right" style="padding: 10px 10px; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 700;">Unitário</th>
                    <th align="right" style="padding: 10px 14px; color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 700;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRowsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totais do Pedido -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #061d2a; border-radius: 8px; border: 1px solid #13384c; padding: 16px;">
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Subtotal dos Produtos:</td>
                  <td align="right" style="padding: 6px 0; color: #FFFFFF; font-size: 13px; font-weight: 500;">
                    ${formatBRL(order.subtotal)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #94a3b8; font-size: 13px;">Frete:</td>
                  <td align="right" style="padding: 6px 0; color: #FFFFFF; font-size: 13px; font-weight: 500;">
                    ${escapeHtml(shippingCostDisplay)}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0 4px 0; border-top: 1px solid #13384c; color: #FFFFFF; font-size: 16px; font-weight: 700;">
                    Total do Pedido:
                  </td>
                  <td align="right" style="padding: 12px 0 4px 0; border-top: 1px solid #13384c; color: #FE5516; font-size: 20px; font-weight: 800;">
                    ${formatBRL(order.total)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Box de Entrega / Retirada -->
          <tr>
            <td style="padding: 0 28px 28px 28px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #032030; border-radius: 8px; border-left: 4px solid #FE5516; padding: 16px 18px;">
                <tr>
                  <td>
                    ${deliveryDetailsHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Canal de Atendimento / Dúvidas -->
          <tr>
            <td style="padding: 20px 28px; background-color: #031824; border-top: 1px solid #13384c; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #FFFFFF; font-size: 14px; font-weight: 600;">
                Ficou com alguma dúvida sobre o seu pedido?
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">
                Fale conosco pelo WhatsApp: <strong style="color: #25D366;"><a href="https://wa.me/5531994838720" target="_blank" style="color: #25D366; text-decoration: underline;">(31) 99483-8720</a></strong><br/>
                Ou responda a este e-mail: <a href="mailto:saturnoembalagens@yahoo.com.br" style="color: #FE5516;">saturnoembalagens@yahoo.com.br</a>
              </p>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td style="padding: 22px 28px; background-color: #000e16; text-align: center; border-top: 1px solid #0f2c3d;">
              <p style="margin: 0 0 6px 0; color: #64748b; font-size: 11px;">
                Saturno Embalagens • Qualidade e Agilidade para seu Delivery
              </p>
              <p style="margin: 0 0 10px 0; color: #475569; font-size: 11px;">
                R. Urupema, nº 150 - São Cosme de Baixo, Santa Luzia - MG, CEP 33130-140
              </p>
              <p style="margin: 0; color: #334155; font-size: 10px;">
                Este é um e-mail transacional automático referente ao seu pedido. Não compartilhe informações confidenciais.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
