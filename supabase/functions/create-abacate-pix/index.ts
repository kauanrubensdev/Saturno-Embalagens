import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

// ── Types ────────────────────────────────────────────────────────────────────

interface CreatePixRequestBody {
  order_id?: string;
  orderId?: string;
  id?: string;
}

interface AbacateCustomerPayload {
  name?: string;
  email?: string;
  cellphone?: string;
  taxId?: string;
}

interface AbacateTransparentData {
  amount: number;
  description: string;
  expiresIn: number;
  customer?: AbacateCustomerPayload;
  metadata?: {
    pedidoId: string;
    [key: string]: unknown;
  };
}

interface AbacateCreateTransparentRequest {
  method: 'PIX';
  data: AbacateTransparentData;
}

interface AbacatePixResponseData {
  id: string;
  brCode: string;
  brCodeBase64: string;
  expiresAt: string;
  [key: string]: unknown;
}

interface AbacateApiResponse {
  data?: AbacatePixResponseData | null;
  success?: boolean;
  error?: string | Record<string, unknown> | null;
}

// Allowed order payment statuses that can generate a PIX billing
const PAYABLE_STATUSES = ['pending', 'failed'];

// AbacatePay PIX billing expiration in seconds (1 hour / 3600 seconds)
const PIX_EXPIRATION_SECONDS = 3600;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Allow only POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método HTTP não permitido. Utilize POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // ── 1. Validate environment & secrets ────────────────────────────────────
    const rawApiKey = Deno.env.get('ABACATEPAY_API_KEY');
    if (!rawApiKey) {
      console.error('[CREATE-ABACATE-PIX] ABACATEPAY_API_KEY não configurada no servidor.');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta (ABACATEPAY_API_KEY ausente).' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanApiKey = rawApiKey.trim().replace(/^["']|["']$/g, '');
    const isProdKey = cleanApiKey.startsWith('abc_prod_');
    const isDevKey = cleanApiKey.startsWith('abc_dev_');
    const keyEnvType = isProdKey ? 'PROD (abc_prod_***)' : isDevKey ? 'DEV (abc_dev_***)' : 'PREFIXO_DESCONHECIDO';
    console.log(`[CREATE-ABACATE-PIX] Chave AbacatePay carregada: ambiente=${keyEnvType}, tamanho=${cleanApiKey.length} caracteres.`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[CREATE-ABACATE-PIX] Variáveis de ambiente Supabase não configuradas.');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta (SUPABASE_URL/SERVICE_KEY).' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Authenticate caller via Supabase JWT ──────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('[CREATE-ABACATE-PIX] Cabeçalho Authorization ausente.');
      return new Response(
        JSON.stringify({ error: 'Cabeçalho de autorização não fornecido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '').trim();
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.warn('[CREATE-ABACATE-PIX] Falha na autenticação do token JWT:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado ou token inválido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Parse and validate request body ───────────────────────────────────
    const body: CreatePixRequestBody = await req.json().catch(() => ({}));
    const rawOrderId = body.order_id || body.orderId || body.id;

    if (!rawOrderId || typeof rawOrderId !== 'string' || !rawOrderId.trim()) {
      console.warn('[CREATE-ABACATE-PIX] Payload inválido, order_id ausente:', body);
      return new Response(
        JSON.stringify({ error: 'ID do pedido (order_id) é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const order_id = rawOrderId.trim();

    // ── 4. Fetch order from database — NEVER trust amount from client ─────────
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .maybeSingle();

    if (orderError) {
      console.error('[CREATE-ABACATE-PIX] Erro no banco de dados ao buscar pedido:', {
        order_id,
        code: orderError.code,
        message: orderError.message,
        details: orderError.details,
      });
      return new Response(
        JSON.stringify({
          error: 'Erro ao consultar o pedido no banco de dados.',
          details: orderError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!order) {
      console.warn(`[CREATE-ABACATE-PIX] Pedido não encontrado no banco com ID: "${order_id}"`);
      return new Response(
        JSON.stringify({ error: `Pedido não encontrado (${order_id}).` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 5. Ownership verification: ensure order belongs to authenticated user ─
    if (order.user_id !== user.id) {
      console.warn(`[CREATE-ABACATE-PIX] Acesso negado: pedido ${order.id} pertence a ${order.user_id}, usuário autenticado é ${user.id}`);
      return new Response(
        JSON.stringify({ error: 'Acesso negado: o pedido não pertence ao usuário autenticado.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 6. Validate order status ─────────────────────────────────────────────
    if (!PAYABLE_STATUSES.includes(order.payment_status)) {
      console.warn(`[CREATE-ABACATE-PIX] Status do pedido ${order.id} incompatível: ${order.payment_status}`);
      return new Response(
        JSON.stringify({
          error: `O pedido não pode receber uma nova cobrança. Status atual: ${order.payment_status}.`,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 7. Validate & ensure payment_method is abacate_pix ───────────────────
    if (order.payment_method !== 'abacate_pix') {
      const { error: updateMethodErr } = await supabaseClient
        .from('orders')
        .update({
          payment_method: 'abacate_pix',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (updateMethodErr) {
        console.warn('[CREATE-ABACATE-PIX] Aviso ao atualizar payment_method do pedido:', updateMethodErr.message);
      }
    }

    // ── 8. Idempotency check: Reuse existing active PIX billing if valid ──────
    const existingPixId = order.abacate_pix_id;
    const existingBrCode = order.abacate_pix_br_code;
    const existingExpiresAt = order.abacate_pix_expires_at;

    if (existingPixId && existingBrCode && existingExpiresAt) {
      const expiresAtDate = new Date(existingExpiresAt);
      const isExpired = isNaN(expiresAtDate.getTime()) || expiresAtDate.getTime() <= Date.now();

      if (!isExpired) {
        console.log(`[CREATE-ABACATE-PIX] Reutilizando cobrança PIX existente ${existingPixId} para o pedido ${order.id}.`);
        return new Response(
          JSON.stringify({
            success: true,
            reused: true,
            data: {
              id: existingPixId,
              brCode: existingBrCode,
              brCodeBase64: order.abacate_pix_qr_code || null,
              expiresAt: existingExpiresAt,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[CREATE-ABACATE-PIX] Cobrança PIX anterior ${existingPixId} expirou. Gerando nova cobrança para o pedido ${order.id}.`);
    }

    // ── 9. Safe conversion: BRL (NUMERIC) to integer cents ───────────────────
    const totalNum = Number(order.total);
    if (isNaN(totalNum) || totalNum <= 0) {
      return new Response(
        JSON.stringify({ error: 'Valor total do pedido inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Safe integer conversion without floating point precision issues
    const amountInCents = Math.round(parseFloat(totalNum.toFixed(2)) * 100);

    if (amountInCents < 50) {
      return new Response(
        JSON.stringify({ error: 'O valor do pedido é inferior ao mínimo permitido (R$ 0,50).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 10. Fetch customer profile info (if available) ───────────────────────
    let customerPayload: AbacateCustomerPayload | undefined = undefined;

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('name, phone')
      .eq('id', user.id)
      .maybeSingle();

    const customerObj: AbacateCustomerPayload = {};
    if (profile?.name && typeof profile.name === 'string' && profile.name.trim()) {
      customerObj.name = profile.name.trim();
    }
    if (user.email && typeof user.email === 'string' && user.email.trim()) {
      customerObj.email = user.email.trim();
    }
    if (profile?.phone && typeof profile.phone === 'string') {
      const cleanPhone = profile.phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        customerObj.cellphone = cleanPhone;
      }
    }

    if (Object.keys(customerObj).length > 0) {
      customerPayload = customerObj;
    }

    // ── 11. Build AbacatePay request payload (POST /v2/transparents/create) ───
    // Observação importante: Para o método PIX, os dados de "customer" são opcionais.
    // Se o objeto "customer" for enviado sem taxId (CPF) ou cellphone completo, a AbacatePay
    // rejeita a requisição com HTTP 422 ("Property 'data.customer.taxId' is missing").
    // Portanto, enviamos os campos oficiais e validados sem campos incompletos.
    const abacatePayload: Record<string, unknown> = {
      method: 'PIX',
      data: {
        amount: amountInCents,
        description: `Pedido #${order.id.slice(0, 8).toUpperCase()} - Saturno Embalagens`,
        expiresIn: PIX_EXPIRATION_SECONDS,
      },
    };

    // ── 12. Call AbacatePay API ──────────────────────────────────────────────
    console.log(`[CREATE-ABACATE-PIX] Criando cobrança PIX na AbacatePay para o pedido ${order.id} (valor: ${amountInCents} centavos, ambiente: ${keyEnvType}).`);
    console.log(`[CREATE-ABACATE-PIX] Payload enviado: ${JSON.stringify(abacatePayload, null, 2)}`);

    const abacateRes = await fetch('https://api.abacatepay.com/v2/transparents/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanApiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SaturnoEmbalagens/1.0',
      },
      body: JSON.stringify(abacatePayload),
    });

    const responseText = await abacateRes.text();
    let abacateJson: AbacateApiResponse = {};
    try {
      abacateJson = JSON.parse(responseText);
    } catch {
      // Resposta não é JSON válido
    }

    if (!abacateRes.ok || !abacateJson.success || !abacateJson.data?.id || !abacateJson.data?.brCode) {
      const errorDetail = abacateJson.error
        ? (typeof abacateJson.error === 'string' ? abacateJson.error : JSON.stringify(abacateJson.error))
        : (responseText ? responseText.slice(0, 300) : `HTTP ${abacateRes.status} ${abacateRes.statusText}`);

      console.error('[CREATE-ABACATE-PIX] Erro retornado pela AbacatePay:', {
        httpStatus: abacateRes.status,
        errorDetail,
        ambienteChave: keyEnvType,
      });

      return new Response(
        JSON.stringify({
          error: `AbacatePay (HTTP ${abacateRes.status}): ${errorDetail}`,
          details: errorDetail,
          httpStatus: abacateRes.status,
          keyEnvType,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pixData = abacateJson.data;

    // ── 13. Persist PIX data on public.orders ────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      abacate_pix_id: pixData.id,
      abacate_pix_br_code: pixData.brCode,
      abacate_pix_qr_code: pixData.brCodeBase64 || null,
      abacate_pix_expires_at: pixData.expiresAt || null,
      payment_method: 'abacate_pix',
      updated_at: new Date().toISOString(),
    };

    const { error: updateOrderError } = await supabaseClient
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (updateOrderError) {
      console.error('[CREATE-ABACATE-PIX] Erro ao salvar dados do PIX no pedido:', updateOrderError.message);
    } else {
      console.log(`[CREATE-ABACATE-PIX] Cobrança PIX ${pixData.id} vinculada com sucesso ao pedido ${order.id}.`);
    }

    // ── 14. Return sanitized response to client ──────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        reused: false,
        data: {
          id: pixData.id,
          brCode: pixData.brCode,
          brCodeBase64: pixData.brCodeBase64,
          expiresAt: pixData.expiresAt,
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno ao processar cobrança PIX.';
    console.error('[CREATE-ABACATE-PIX-EXCEPTION]', errorMsg);

    return new Response(
      JSON.stringify({ error: 'Erro interno ao gerar cobrança PIX.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
