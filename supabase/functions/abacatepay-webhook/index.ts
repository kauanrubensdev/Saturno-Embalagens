import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ── Types ────────────────────────────────────────────────────────────────────

interface AbacateWebhookData {
  id?: string;
  status?: string;
  amount?: number;
  metadata?: {
    orderId?: string;
    order_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface AbacateWebhookPayload {
  id?: string;
  event_id?: string;
  eventId?: string;
  event?: string;
  event_type?: string;
  type?: string;
  data?: AbacateWebhookData;
  metadata?: {
    orderId?: string;
    order_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ── Helper: Constant-time HMAC-SHA256 verification ───────────────────────────

async function verifyHmacSha256(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const sigArray = Array.from(new Uint8Array(sigBuffer));
    const computedHex = sigArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    const normalizedSignature = signature.trim().toLowerCase();

    if (computedHex.length !== normalizedSignature.length) {
      return false;
    }

    // Constant-time equality comparison to prevent timing attacks
    let diff = 0;
    for (let i = 0; i < computedHex.length; i++) {
      diff |= computedHex.charCodeAt(i) ^ normalizedSignature.charCodeAt(i);
    }

    return diff === 0;
  } catch (err) {
    console.error('[ABACATEPAY-WEBHOOK] Erro no cálculo HMAC:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

// ── Webhook Handler ──────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido. Utilize POST.' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── 1. Validate environment & webhook secret ──────────────────────────────
  const webhookSecret = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[ABACATEPAY-WEBHOOK] ABACATEPAY_WEBHOOK_SECRET não configurada no servidor.');
    return new Response(
      JSON.stringify({ error: 'Configuração do servidor incompleta.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[ABACATEPAY-WEBHOOK] Variáveis de ambiente Supabase não configuradas.');
    return new Response(
      JSON.stringify({ error: 'Configuração do servidor incompleta.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── 2. Read raw body and signature header ──────────────────────────────────
  const rawBody = await req.text();
  const signature =
    req.headers.get('X-Webhook-Signature') ||
    req.headers.get('x-webhook-signature');

  if (!signature) {
    console.warn('[ABACATEPAY-WEBHOOK] Requisição rejeitada: cabeçalho X-Webhook-Signature ausente.');
    return new Response(
      JSON.stringify({ error: 'Assinatura do webhook ausente.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── 3. Verify HMAC-SHA256 signature on raw body ───────────────────────────
  const isValidSignature = await verifyHmacSha256(rawBody, signature, webhookSecret);
  if (!isValidSignature) {
    console.warn('[ABACATEPAY-WEBHOOK] Requisição rejeitada: assinatura HMAC inválida.');
    return new Response(
      JSON.stringify({ error: 'Assinatura inválida.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── 4. Parse JSON payload ─────────────────────────────────────────────────
  let payload: AbacateWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (parseErr) {
    console.error('[ABACATEPAY-WEBHOOK] Erro ao parsear JSON do body:', parseErr);
    return new Response(
      JSON.stringify({ error: 'Payload JSON inválido.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Extract event metadata
  const eventType = payload.event || payload.event_type || payload.type || 'unknown';
  const rawEventId = payload.id || payload.event_id || payload.eventId;
  const pixId = payload.data?.id;

  // Determine a unique and deterministic event ID for idempotency tracking
  let eventId = rawEventId;
  if (!eventId && pixId) {
    eventId = `${eventType}_${pixId}`;
  }
  if (!eventId) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody));
    eventId = `evt_${Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)}`;
  }

  // Extract order identifier (prioritize metadata.orderId)
  const orderIdFromMetadata =
    payload.data?.metadata?.orderId ||
    payload.data?.metadata?.order_id ||
    payload.metadata?.orderId ||
    payload.metadata?.order_id;

  console.log(`[ABACATEPAY-WEBHOOK] Processando evento: ${eventType} (ID: ${eventId})`);

  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── 5. Locate order in database ──────────────────────────────────────────
    let targetOrder: {
      id: string;
      payment_method: string;
      payment_status: string;
      status: string;
      abacate_pix_id: string | null;
    } | null = null;

    if (orderIdFromMetadata && typeof orderIdFromMetadata === 'string') {
      const { data: orderById } = await supabaseClient
        .from('orders')
        .select('id, payment_method, payment_status, status, abacate_pix_id')
        .eq('id', orderIdFromMetadata)
        .maybeSingle();

      if (orderById) {
        targetOrder = orderById;
      }
    }

    if (!targetOrder && pixId && typeof pixId === 'string') {
      const { data: orderByPixId } = await supabaseClient
        .from('orders')
        .select('id, payment_method, payment_status, status, abacate_pix_id')
        .eq('abacate_pix_id', pixId)
        .maybeSingle();

      if (orderByPixId) {
        targetOrder = orderByPixId;
      }
    }

    const resolvedOrderId = targetOrder?.id || (orderIdFromMetadata ? String(orderIdFromMetadata) : null);

    // ── 6. Idempotency: Register event in public.abacatepay_webhook_events ────
    // Using PRIMARY KEY constraint on `id` to handle concurrent duplicate webhooks cleanly
    const { error: insertEventError } = await supabaseClient
      .from('abacatepay_webhook_events')
      .insert({
        id: eventId,
        event_type: eventType,
        order_id: targetOrder ? targetOrder.id : null,
        payload: payload,
      });

    if (insertEventError) {
      // Postgres error 23505 is unique_violation (PRIMARY KEY collision)
      if (insertEventError.code === '23505' || insertEventError.message?.includes('duplicate key')) {
        console.log(`[ABACATEPAY-WEBHOOK] Evento ${eventId} já foi processado anteriormente (idempotência garantida).`);
        return new Response(
          JSON.stringify({ received: true, already_processed: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      console.error('[ABACATEPAY-WEBHOOK] Erro ao registrar evento na tabela de auditoria:', insertEventError.message);
      // Non-blocking: continue processing order update
    }

    // ── 7. Process Order Status based on Event Type ──────────────────────────
    if (!targetOrder) {
      console.warn(`[ABACATEPAY-WEBHOOK] Nenhum pedido encontrado correspondente ao evento ${eventId} (orderId: ${orderIdFromMetadata || 'N/A'}, pixId: ${pixId || 'N/A'}).`);
      return new Response(
        JSON.stringify({ received: true, order_found: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Order validations
    if (targetOrder.status === 'cancelled') {
      console.warn(`[ABACATEPAY-WEBHOOK] Pedido ${targetOrder.id} está cancelado. Nenhuma atualização de pagamento aplicada.`);
      return new Response(
        JSON.stringify({ received: true, order_status: 'cancelled' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (eventType === 'transparent.completed') {
      if (targetOrder.payment_status === 'paid') {
        console.log(`[ABACATEPAY-WEBHOOK] Pedido ${targetOrder.id} já consta como 'paid'. Nenhuma alteração necessária.`);
        return new Response(
          JSON.stringify({ received: true, payment_status: 'paid', updated: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Update payment_status to 'paid'
      const { error: updateOrderErr } = await supabaseClient
        .from('orders')
        .update({
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetOrder.id);

      if (updateOrderErr) {
        console.error(`[ABACATEPAY-WEBHOOK] Erro ao atualizar status do pedido ${targetOrder.id}:`, updateOrderErr.message);
        throw updateOrderErr;
      }

      console.log(`[ABACATEPAY-WEBHOOK] Pedido ${targetOrder.id} marcado como 'paid' com sucesso.`);
    } else {
      console.log(`[ABACATEPAY-WEBHOOK] Evento '${eventType}' registrado para o pedido ${targetOrder.id}. Nenhuma alteração de status necessária.`);
    }

    return new Response(
      JSON.stringify({ received: true, success: true, order_id: targetOrder.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno ao processar webhook.';
    console.error('[ABACATEPAY-WEBHOOK-HANDLER-EXCEPTION]', errorMsg);

    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar webhook.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
