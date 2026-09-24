import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY não está configurada no ambiente do Supabase.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configurações do Supabase não encontradas no ambiente da Edge Function.');
    }

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Cabeçalho de autorização não fornecido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'ID do pedido (order_id) é obrigatório.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch order from database
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, user_id, total, payment_method, payment_status, stripe_payment_intent_id, pix_qr_code_url, pix_copy_paste, pix_expires_at')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    if (order.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado: o pedido não pertence ao usuário autenticado.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If order already has active PIX data and is pending, return existing data
    if (order.pix_copy_paste && order.payment_status === 'pending') {
      return new Response(
        JSON.stringify({
          success: true,
          payment_intent_id: order.stripe_payment_intent_id,
          pix_qr_code_url: order.pix_qr_code_url,
          pix_copy_paste: order.pix_copy_paste,
          pix_expires_at: order.pix_expires_at,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Create PIX PaymentIntent (amount in centavos)
    const amountInCents = Math.round(Number(order.total) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'brl',
      payment_method_types: ['pix'],
      payment_method_data: {
        type: 'pix',
      },
      confirm: true,
      metadata: {
        order_id: order.id,
        user_id: user.id,
        app: 'SaturnoEmbalagens',
      },
    });

    const pixAction = (paymentIntent as any).next_action?.pix_display_qr_code;
    const pixCopyPaste = pixAction?.data || null;
    const pixQrCodeUrl = pixAction?.image_url_png || pixAction?.image_url_svg || pixAction?.hosted_instructions_url || null;
    const pixExpiresAt = pixAction?.expires_at ? new Date(pixAction.expires_at * 1000).toISOString() : null;
    const hostedInstructionsUrl = pixAction?.hosted_instructions_url || null;

    // Save PIX metadata to order
    await supabaseClient
      .from('orders')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        pix_qr_code_url: pixQrCodeUrl,
        pix_copy_paste: pixCopyPaste,
        pix_expires_at: pixExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent_id: paymentIntent.id,
        pix_qr_code_url: pixQrCodeUrl,
        pix_copy_paste: pixCopyPaste,
        pix_expires_at: pixExpiresAt,
        hosted_instructions_url: hostedInstructionsUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[CREATE-PIX-PAYMENT-ERROR]', err);
    return new Response(
      JSON.stringify({
        error: err.message || 'Erro ao gerar cobrança PIX no Stripe.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
