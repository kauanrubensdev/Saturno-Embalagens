import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método HTTP não permitido. Utilize POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const abacateApiKey = Deno.env.get('ABACATEPAY_API_KEY');
    if (!abacateApiKey) {
      console.error('[SIMULATE-ABACATE-PIX] ABACATEPAY_API_KEY não configurada no servidor.');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[SIMULATE-ABACATE-PIX] Variáveis de ambiente Supabase não configuradas.');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Cabeçalho de autorização não fornecido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado ou token inválido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== 'admin') {
      console.warn(`[SIMULATE-ABACATE-PIX] Acesso negado: usuário ${user.id} não é admin.`);
      return new Response(
        JSON.stringify({ error: 'Acesso negado: apenas administradores podem usar esta ferramenta.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawOrderId = body.order_id || body.orderId || body.id;

    if (!rawOrderId || typeof rawOrderId !== 'string' || !rawOrderId.trim()) {
      return new Response(
        JSON.stringify({ error: 'ID do pedido é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const order_id = rawOrderId.trim();

    // Fetch order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, payment_method, payment_status, abacate_pix_id')
      .eq('id', order_id)
      .maybeSingle();

    if (orderError) {
      console.error('[SIMULATE-ABACATE-PIX] Erro ao buscar pedido:', orderError);
      return new Response(
        JSON.stringify({ error: 'Erro interno ao consultar o pedido.', details: orderError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!order) {
      return new Response(
        JSON.stringify({ error: `Pedido não encontrado (${order_id}).` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.payment_method !== 'abacate_pix') {
      return new Response(
        JSON.stringify({ error: 'Este pedido não utilizou PIX da AbacatePay.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!order.abacate_pix_id) {
      return new Response(
        JSON.stringify({ error: 'Este pedido não possui ID de cobrança PIX gerada (abacate_pix_id nulo).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'Este pedido já está pago.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pixId = order.abacate_pix_id;

    console.log(`[SIMULATE-ABACATE-PIX] Solicitando simulação de pagamento para o PIX ${pixId} (pedido ${order.id})`);

    const abacateRes = await fetch(`https://api.abacatepay.com/v2/transparents/simulate-payment?id=${pixId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${abacateApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const abacateJson = await abacateRes.json().catch(() => ({}));

    if (!abacateRes.ok) {
      console.error('[SIMULATE-ABACATE-PIX] Erro retornado pela AbacatePay na simulação:', {
        httpStatus: abacateRes.status,
        response: abacateJson,
      });

      return new Response(
        JSON.stringify({
          error: 'A API AbacatePay rejeitou a simulação.',
          details: abacateJson.error || `HTTP ${abacateRes.status}`,
          abacateRaw: abacateJson
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SIMULATE-ABACATE-PIX] Simulação efetuada com sucesso para PIX ${pixId}. Aguardando webhook.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Simulação aceita pela AbacatePay. Aguarde o webhook processar a confirmação de pagamento.',
        abacateRaw: abacateJson
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno';
    console.error('[SIMULATE-ABACATE-PIX-EXCEPTION]', errorMsg);

    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar a simulação.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
