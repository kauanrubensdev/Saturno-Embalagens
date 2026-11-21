import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ── Types ────────────────────────────────────────────────────────────────────

interface AbacateWebhookData {
  id?: string;
  status?: string;
  amount?: number;
  externalId?: string;
  external_id?: string;
  metadata?: {
    orderId?: string;
    order_id?: string;
    pedidoId?: string;
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
  apiVersion?: number;
  devMode?: boolean;
  data?: AbacateWebhookData;
  metadata?: {
    orderId?: string;
    order_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ── Helper: Constant-time HMAC-SHA256 verification (Base64 output) ───────────
// IMPORTANT: AbacatePay signs webhooks with HMAC-SHA256 and encodes the result
// as Base64 (not hex). The header is X-Webhook-Signature.
//
async function verifyHmacSha256Base64(
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

    // Encode as Base64 (AbacatePay format)
    const base64Sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
    const normalizedSignature = signature.trim();

    if (base64Sig.length !== normalizedSignature.length) {
      return false;
    }

    // Constant-time equality comparison to prevent timing attacks
    let diff = 0;
    for (let i = 0; i < base64Sig.length; i++) {
      diff |= base64Sig.charCodeAt(i) ^ normalizedSignature.charCodeAt(i);
    }

    return diff === 0;
  } catch (err) {
    console.error('[ABACATEPAY-WEBHOOK] Erro no cálculo HMAC-SHA256/Base64:', err instanceof Error ? err.message : String(err));
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

  // ── 2. Read raw body ──────────────────────────────────────────────────────
  const rawBody = await req.text();

  // ── 3. Authentication: dual layer (HMAC header + optional query param) ────
  //
  // The AbacatePay can authenticate webhooks in two ways:
  //   a) HMAC-SHA256 (Base64) in the X-Webhook-Signature header
  //   b) Plain secret appended as ?webhookSecret=<SECRET> in the URL query string
  //
  // We validate whichever is present. The header HMAC is preferred and more secure.

  const signature =
    req.headers.get('X-Webhook-Signature') ||
    req.headers.get('x-webhook-signature');

  const reqUrl = new URL(req.url);
  const querySecret = reqUrl.searchParams.get('webhookSecret');

  let authenticated = false;
  let authMethod = 'none';

  if (signature) {
    // Validate HMAC-SHA256 (Base64)
    const isValidHmac = await verifyHmacSha256Base64(rawBody, signature, webhookSecret);
    if (isValidHmac) {
      authenticated = true;
      authMethod = 'hmac-sha256-base64';
    } else {
      console.warn('[ABACATEPAY-WEBHOOK] Assinatura HMAC inválida. Header recebido (truncado):', signature.slice(0, 20) + '...');
    }
  }

  if (!authenticated && querySecret) {
    // Fallback: plain secret in query string
    if (querySecret === webhookSecret) {
      authenticated = true;
      authMethod = 'query-secret';
    } else {
      console.warn('[ABACATEPAY-WEBHOOK] webhookSecret na query string não corresponde ao segredo configurado.');
    }
  }

  if (!authenticated) {
    if (!signature && !querySecret) {
      console.warn('[ABACATEPAY-WEBHOOK] Requisição rejeitada: nenhum método de autenticação fornecido (X-Webhook-Signature header ou ?webhookSecret query param).');
    } else {
      console.warn('[ABACATEPAY-WEBHOOK] Requisição rejeitada: autenticação falhou. Signature header presente:', Boolean(signature), '/ Query secret presente:', Boolean(querySecret));
    }
    return new Response(
      JSON.stringify({ error: 'Autenticação do webhook falhou.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[ABACATEPAY-WEBHOOK] Autenticado via: ${authMethod}`);

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
  const devMode = payload.devMode ?? payload.data?.devMode ?? false;

  console.log(`[ABACATEPAY-WEBHOOK] Evento recebido: type="${eventType}", pixId="${pixId || 'N/A'}", devMode=${devMode}, rawBody_len=${rawBody.length}`);

  // Determine a unique and deterministic event ID for idempotency tracking
  let eventId = rawEventId;
  if (!eventId && pixId) {
    eventId = `${eventType}_${pixId}`;
  }
  if (!eventId) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawBody));
    eventId = `evt_${Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)}`;
  }

  // Extract order identifier – covers all known field positions:
  // 1. data.externalId (sent by create-abacate-pix as the order UUID)
  // 2. data.metadata.orderId / order_id / pedidoId
  // 3. top-level metadata.*
  const orderIdFromPayload =
    payload.data?.externalId ||
    payload.data?.external_id ||
    payload.data?.metadata?.orderId ||
    payload.data?.metadata?.order_id ||
    payload.data?.metadata?.pedidoId ||
    payload.metadata?.orderId ||
    payload.metadata?.order_id;

  console.log(`[ABACATEPAY-WEBHOOK] Processando evento: ${eventType} (ID: ${eventId}, orderIdFromPayload: ${orderIdFromPayload || 'N/A'})`);

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

    // Strategy 1: look up by order UUID from payload
    if (orderIdFromPayload && typeof orderIdFromPayload === 'string') {
      const { data: orderById, error: orderByIdErr } = await supabaseClient
        .from('orders')
        .select('id, payment_method, payment_status, status, abacate_pix_id')
        .eq('id', orderIdFromPayload)
        .maybeSingle();

      if (orderByIdErr) {
        console.error('[ABACATEPAY-WEBHOOK] Erro ao buscar pedido por ID:', orderByIdErr.message);
      } else if (orderById) {
        targetOrder = orderById;
        console.log(`[ABACATEPAY-WEBHOOK] Pedido localizado via orderIdFromPayload: ${targetOrder.id}`);
      }
    }

    // Strategy 2: look up by abacate_pix_id (data.id from API response)
    if (!targetOrder && pixId && typeof pixId === 'string') {
      const { data: orderByPixId, error: orderByPixErr } = await supabaseClient
        .from('orders')
        .select('id, payment_method, payment_status, status, abacate_pix_id')
        .eq('abacate_pix_id', pixId)
        .maybeSingle();

      if (orderByPixErr) {
        console.error('[ABACATEPAY-WEBHOOK] Erro ao buscar pedido por abacate_pix_id:', orderByPixErr.message);
      } else if (orderByPixId) {
        targetOrder = orderByPixId;
        console.log(`[ABACATEPAY-WEBHOOK] Pedido localizado via abacate_pix_id (${pixId}): ${targetOrder.id}`);
      }
    }

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
      console.warn(`[ABACATEPAY-WEBHOOK] Nenhum pedido encontrado para o evento ${eventId}. orderIdFromPayload="${orderIdFromPayload || 'N/A'}", pixId="${pixId || 'N/A'}". Verifique se o campo externalId está sendo enviado na criação do PIX.`);
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

      console.log(`[ABACATEPAY-WEBHOOK] ✓ Pedido ${targetOrder.id} marcado como PAID com sucesso (evento: ${eventType}, devMode: ${devMode}).`);
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
