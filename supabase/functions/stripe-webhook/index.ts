import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Método não permitido', { status: 405 });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!stripeSecretKey || !stripeWebhookSecret) {
    console.error('[STRIPE-WEBHOOK] Chaves do Stripe não configuradas no ambiente.');
    return new Response('Stripe secrets não configuradas no servidor.', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Assinatura do Stripe ausente.', { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, stripeWebhookSecret);
  } catch (err: any) {
    console.error(`[STRIPE-WEBHOOK-ERROR] Falha na validação de assinatura: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`[STRIPE-WEBHOOK] Evento recebido: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata?.order_id;

        if (!orderId) {
          // Try to lookup order by stripe_payment_intent_id
          const { data: foundOrder } = await supabaseClient
            .from('orders')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntent.id)
            .single();

          if (foundOrder?.id) {
            await supabaseClient.rpc('confirm_stripe_payment', {
              p_order_id: foundOrder.id,
              p_payment_intent_id: paymentIntent.id,
              p_event_id: event.id,
            });
          } else {
            console.warn(`[STRIPE-WEBHOOK] Nenhum order_id encontrado para PaymentIntent ${paymentIntent.id}`);
          }
        } else {
          // Confirm payment via idempotent RPC
          const { data, error } = await supabaseClient.rpc('confirm_stripe_payment', {
            p_order_id: orderId,
            p_payment_intent_id: paymentIntent.id,
            p_event_id: event.id,
          });

          if (error) {
            console.error('[STRIPE-WEBHOOK] Erro ao chamar confirm_stripe_payment:', error);
            throw error;
          }

          console.log(`[STRIPE-WEBHOOK] Pedido ${orderId} confirmado com sucesso.`, data);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata?.order_id;

        if (orderId) {
          await supabaseClient
            .from('orders')
            .update({
              payment_status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);
        }
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata?.order_id;

        if (orderId) {
          await supabaseClient
            .from('orders')
            .update({
              payment_status: 'cancelled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);
        }
        break;
      }

      default:
        console.log(`[STRIPE-WEBHOOK] Evento ${event.type} ignorado.`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error(`[STRIPE-WEBHOOK-HANDLER-ERROR] ${err.message}`);
    return new Response(`Erro ao processar evento: ${err.message}`, { status: 500 });
  }
});
