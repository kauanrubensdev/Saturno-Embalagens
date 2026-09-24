import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

// Allowed order payment statuses that can receive a new PaymentIntent
const PAYABLE_STATUSES = ['pending', 'failed'];

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Validate environment ──────────────────────────────────────────────
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('[CREATE-STRIPE-PAYMENT] STRIPE_SECRET_KEY não configurada.');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[CREATE-STRIPE-PAYMENT] Variáveis do Supabase não configuradas.');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Authenticate caller ───────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Cabeçalho de autorização não fornecido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Parse & validate request body ────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { order_id } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'ID do pedido (order_id) é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Fetch order — NEVER trust amount from frontend ────────────────────
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, user_id, total, payment_method, payment_status, stripe_payment_intent_id')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 5. Ownership check ───────────────────────────────────────────────────
    if (order.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado: o pedido não pertence ao usuário autenticado.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 6. Validate order state ──────────────────────────────────────────────
    if (!PAYABLE_STATUSES.includes(order.payment_status)) {
      return new Response(
        JSON.stringify({
          error: `O pedido não pode receber um novo pagamento. Status atual: ${order.payment_status}.`,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 7. Idempotency — reuse existing PaymentIntent if still usable ────────
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    if (order.stripe_payment_intent_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
        // Reuse if the intent is still awaiting payment (not cancelled/succeeded)
        if (
          existing.status === 'requires_payment_method' ||
          existing.status === 'requires_confirmation' ||
          existing.status === 'requires_action'
        ) {
          console.log(
            `[CREATE-STRIPE-PAYMENT] Reutilizando PaymentIntent existente ${existing.id} para pedido ${order.id}.`
          );
          return new Response(
            JSON.stringify({ success: true, client_secret: existing.client_secret }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Otherwise fall through to create a new one
        console.log(
          `[CREATE-STRIPE-PAYMENT] PaymentIntent ${existing.id} em status '${existing.status}', criando novo.`
        );
      } catch (retrieveErr: any) {
        console.warn(
          `[CREATE-STRIPE-PAYMENT] Não foi possível recuperar PaymentIntent existente: ${retrieveErr.message}`
        );
      }
    }

    // ── 8. Create new PaymentIntent ──────────────────────────────────────────
    const amountInCents = Math.round(Number(order.total) * 100);

    if (amountInCents < 50) {
      return new Response(
        JSON.stringify({ error: 'O valor do pedido é inferior ao mínimo aceito (R$ 0,50).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'brl',
      // automatic_payment_methods lets Stripe present whichever methods are
      // enabled on the Dashboard (Cards, Apple Pay, Google Pay, Boleto, etc.)
      // PIX is NOT enabled on this account yet, so it will not appear.
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        order_id: order.id,
        user_id: user.id,
        app: 'SaturnoEmbalagens',
      },
    });

    console.log(
      `[CREATE-STRIPE-PAYMENT] PaymentIntent criado: ${paymentIntent.id} para pedido ${order.id}.`
    );

    // ── 9. Persist payment_intent_id on the order ────────────────────────────
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      console.error(
        `[CREATE-STRIPE-PAYMENT] Erro ao salvar stripe_payment_intent_id no pedido: ${updateError.message}`
      );
      // Non-fatal: we still return the client_secret so the frontend can proceed
    }

    // ── 10. Return ONLY the client_secret — never expose the secret key ──────
    return new Response(
      JSON.stringify({ success: true, client_secret: paymentIntent.client_secret }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[CREATE-STRIPE-PAYMENT-ERROR]', err.message);
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno ao criar pagamento.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
