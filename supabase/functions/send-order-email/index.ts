// supabase/functions/send-order-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';
import { renderEmailTemplate } from './templates.ts';
import {
  EmailType,
  VALID_EMAIL_TYPES,
  isValidEmailType,
  OrderEmailQueueRecord,
  OrderRecord,
  OrderItemRecord,
  AddressRecord,
  ProcessQueueOptions,
  ProcessResultItem,
} from './types.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_SENDER = 'Saturno Embalagens <pedidos@mail.saturnoembalagens.com.br>';
const DEFAULT_REPLY_TO = 'saturnoembalagens@yahoo.com.br';
const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;
const DEFAULT_STALE_MINUTES = 5;

// Validador de formato UUID v4 / padrão RFC 4122
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Validador de formato de e-mail RFC 5322 simplificado
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida estritamente se uma string é um endereço de e-mail bem formatado
 */
function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length > 3 && trimmed.length <= 254 && EMAIL_REGEX.test(trimmed);
}

/**
 * Comparação em tempo constante para evitar ataques de timing na verificação de tokens/chaves
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Validação rigorosa de autorização.
 * Permite apenas:
 * 1. Chamada interna com a SUPABASE_SERVICE_ROLE_KEY
 * 2. Chamada autenticada de usuário cujo profile possua role === 'admin'
 */
// deno-lint-ignore no-explicit-any
async function authorizeCaller(
  req: Request,
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  serviceRoleKey: string
): Promise<{ authorized: boolean; reason?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { authorized: false, reason: 'Cabeçalho Authorization não fornecido.' };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // 1. Service role direto (chamadas internas backend / cron / triggers)
  if (constantTimeCompare(token, serviceRoleKey.trim())) {
    return { authorized: true };
  }

  // 2. Token de usuário autenticado — conferir se é admin
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return { authorized: false, reason: 'Token de autorização inválido ou expirado.' };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    return {
      authorized: false,
      reason: 'Acesso restrito. Somente administradores ou chamadas internas podem acionar esta função.',
    };
  }

  return { authorized: true };
}

/**
 * Resolução compartilhada e unificada do e-mail do destinatário.
 * Regras padronizadas:
 * 1. Se queueEmail for fornecido (fluxo de fila) e for válido, tem precedência.
 * 2. Prioriza orders.customer_email se preenchido e válido.
 * 3. Se vazio, consulta auth.users utilizando order.user_id via supabaseAdmin.auth.admin.getUserById.
 * 4. Se ainda vazio e manualPreviewEmail for fornecido (somente no modo preview_only), utiliza o e-mail manual se válido.
 * 5. NUNCA utiliza cliente@exemplo.com ou destinatários fictícios.
 * 6. Retorna null se nenhum e-mail válido for encontrado.
 */
// deno-lint-ignore no-explicit-any
async function resolveRecipientEmail(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  order: OrderRecord,
  options: {
    queueEmail?: string | null;
    manualPreviewEmail?: string | null;
  } = {}
): Promise<{ email: string | null; source: 'queue' | 'order_customer_email' | 'auth_user' | 'manual_preview' | 'none' }> {
  // 1. E-mail originado da própria fila (se existir e for válido)
  if (options.queueEmail && isValidEmail(options.queueEmail)) {
    return { email: options.queueEmail.trim(), source: 'queue' };
  }

  // 2. Prioridade principal: orders.customer_email
  if (order.customer_email && isValidEmail(order.customer_email)) {
    return { email: order.customer_email.trim(), source: 'order_customer_email' };
  }

  // 3. Consulta ao cadastro de autenticação auth.users via orders.user_id
  if (order.user_id && typeof order.user_id === 'string' && UUID_REGEX.test(order.user_id.trim())) {
    try {
      const { data: authUser, error: authUserErr } = await supabaseAdmin.auth.admin.getUserById(order.user_id.trim());
      if (!authUserErr && authUser?.user?.email && isValidEmail(authUser.user.email)) {
        return { email: authUser.user.email.trim(), source: 'auth_user' };
      }
    } catch (authLookupErr) {
      console.warn(`[SEND-ORDER-EMAIL] Falha ao consultar auth.users para user_id ${order.user_id}:`, authLookupErr);
    }
  }

  // 4. Override manual fornecido exclusivamente para preview (body.recipient_email)
  if (options.manualPreviewEmail && isValidEmail(options.manualPreviewEmail)) {
    return { email: options.manualPreviewEmail.trim(), source: 'manual_preview' };
  }

  // 5. Sem e-mail válido: não inventa endereço fictício
  return { email: null, source: 'none' };
}

/**
 * Atualiza um registro da fila aplicando bloqueio de concorrência por Lease e versão (optimistic locking).
 *
 * Garante que:
 * 1. O item ainda esteja em status 'processing'.
 * 2. O token de lease (UUID gerado na captura) ainda pertença ao worker atual.
 * 3. O timestamp updated_at corresponda exatamente ao momento da captura do lease.
 *
 * Se outro worker recuperou o registro por tempo expirado (stale timeout), esta atualização
 * afetará 0 linhas e retornará success: false, impedindo que o worker defasado sobrescreva
 * o trabalho do worker ativo.
 */
// deno-lint-ignore no-explicit-any
async function updateWithLeaseGuard(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  queueId: string,
  workerLeaseToken: string,
  claimUpdatedAt: string,
  updates: Record<string, unknown>
): Promise<{ success: boolean; data?: OrderEmailQueueRecord }> {
  const { data, error } = await supabaseAdmin
    .from('order_email_queue')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', queueId)
    .eq('status', 'processing')
    .eq('payload->>lease_token', workerLeaseToken)
    .eq('updated_at', claimUpdatedAt)
    .select()
    .maybeSingle();

  if (error || !data) {
    console.warn(
      `[SEND-ORDER-EMAIL] Lease perdido ou assumido por outro worker para o item ${queueId}. Atualização descartada para evitar corrida.`
    );
    return { success: false };
  }

  return { success: true, data };
}

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Apenas POST permitido
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método HTTP não permitido. Utilize POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. Variáveis de ambiente
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const rawResendKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[SEND-ORDER-EMAIL] Variáveis Supabase ausentes no ambiente.');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanResendKey = (rawResendKey || '').trim().replace(/^["']|["']$/g, '');

    // Inicializa cliente administrativo com service_role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Autenticação e Autorização
    const authCheck = await authorizeCaller(req, supabaseAdmin, supabaseServiceKey);
    if (!authCheck.authorized) {
      console.warn('[SEND-ORDER-EMAIL] Chamada não autorizada:', authCheck.reason);
      return new Response(
        JSON.stringify({ error: authCheck.reason }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Leitura e validação estrita do corpo da requisição (SEM req.json().catch)
    let rawBody: unknown = {};
    const rawText = await req.text();

    if (rawText && rawText.trim().length > 0) {
      try {
        rawBody = JSON.parse(rawText);
      } catch (_jsonErr) {
        return new Response(
          JSON.stringify({ error: 'Corpo da requisição deve ser um JSON válido.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Valida se o corpo recebido é um objeto JSON plano (não array, null ou primitivo)
    if (typeof rawBody !== 'object' || rawBody === null || Array.isArray(rawBody)) {
      return new Response(
        JSON.stringify({ error: 'O corpo da requisição deve ser um objeto JSON.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = rawBody as Record<string, unknown>;

    // Validação estrita de preview_only: se presente, deve ser EXCLUSIVAMENTE boolean
    if ('preview_only' in body && typeof body.preview_only !== 'boolean') {
      return new Response(
        JSON.stringify({
          error: 'O parâmetro preview_only, quando fornecido, deve ser exclusivamente booleano (true ou false).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação estrita de dry_run: se presente, deve ser EXCLUSIVAMENTE boolean
    if ('dry_run' in body && typeof body.dry_run !== 'boolean') {
      return new Response(
        JSON.stringify({
          error: 'O parâmetro dry_run, quando fornecido, deve ser exclusivamente booleano (true ou false).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação estrita de stale_timeout_minutes: se presente, deve ser número finito entre 1 e 1440
    if ('stale_timeout_minutes' in body) {
      const staleVal = body.stale_timeout_minutes;
      if (
        typeof staleVal !== 'number' ||
        !Number.isFinite(staleVal) ||
        staleVal < 1 ||
        staleVal > 1440
      ) {
        return new Response(
          JSON.stringify({
            error: 'O parâmetro stale_timeout_minutes deve ser um número finito entre 1 e 1440 minutos.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validação estrita de batch_size: se presente, deve ser número inteiro entre 1 e MAX_BATCH_SIZE (50)
    if ('batch_size' in body) {
      const bSize = body.batch_size;
      if (typeof bSize !== 'number' || !Number.isInteger(bSize) || bSize < 1 || bSize > MAX_BATCH_SIZE) {
        return new Response(
          JSON.stringify({
            error: `O parâmetro batch_size deve ser um número inteiro entre 1 e ${MAX_BATCH_SIZE}.`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validação de order_id
    if ('order_id' in body) {
      if (typeof body.order_id !== 'string' || !UUID_REGEX.test(body.order_id.trim())) {
        return new Response(
          JSON.stringify({ error: 'O parâmetro order_id deve ser uma string UUID válida.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validação de queue_id
    if ('queue_id' in body) {
      if (typeof body.queue_id !== 'string' || !UUID_REGEX.test(body.queue_id.trim())) {
        return new Response(
          JSON.stringify({ error: 'O parâmetro queue_id deve ser uma string UUID válida.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validação de email_type
    if ('email_type' in body) {
      if (!isValidEmailType(body.email_type)) {
        return new Response(
          JSON.stringify({
            error: `O parâmetro email_type é inválido. Tipos permitidos: ${VALID_EMAIL_TYPES.join(', ')}`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validação de recipient_email: se presente, deve ter formato de e-mail válido.
    // Nota de segurança: recipient_email só é utilizado no modo preview_only; no fluxo real da fila ele é completamente ignorado.
    if ('recipient_email' in body) {
      if (typeof body.recipient_email !== 'string' || !isValidEmail(body.recipient_email)) {
        return new Response(
          JSON.stringify({
            error: 'O parâmetro recipient_email, quando fornecido, deve ser um endereço de e-mail válido.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Fluxo exclusivo de PREVIEW_ONLY (nunca altera o banco nem envia e-mails)
    if (body.preview_only === true) {
      if (!body.order_id || typeof body.order_id !== 'string' || !UUID_REGEX.test(body.order_id.trim())) {
        return new Response(
          JSON.stringify({ error: 'Para preview_only, order_id deve ser obrigatoriamente informado e ser um UUID válido.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.email_type || !isValidEmailType(body.email_type)) {
        return new Response(
          JSON.stringify({
            error: `Para preview_only, email_type deve ser informado. Tipos permitidos: ${VALID_EMAIL_TYPES.join(', ')}`,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const previewOrderId = body.order_id.trim();
      const previewEmailType = body.email_type as EmailType;

      console.log(`[SEND-ORDER-EMAIL] Executando modo preview_only para order_id: ${previewOrderId}, tipo: ${previewEmailType}`);

      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', previewOrderId)
        .maybeSingle();

      if (orderErr) {
        return new Response(
          JSON.stringify({ error: `Erro ao consultar pedido no banco: ${orderErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!order) {
        return new Response(
          JSON.stringify({ error: 'Pedido informado não encontrado na base de dados.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: items, error: itemsErr } = await supabaseAdmin
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      if (itemsErr) {
        return new Response(
          JSON.stringify({ error: `Erro ao consultar itens do pedido: ${itemsErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let address: AddressRecord | null = null;
      if (order.delivery_type === 'delivery' && order.shipping_address_id) {
        const { data: addr, error: addrErr } = await supabaseAdmin
          .from('addresses')
          .select('*')
          .eq('id', order.shipping_address_id)
          .maybeSingle();

        if (addrErr) {
          return new Response(
            JSON.stringify({ error: `Erro ao consultar endereço de entrega: ${addrErr.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        address = addr;
      }

      // Resolução unificada e padronizada do destinatário para o preview
      const manualPreviewEmail = typeof body.recipient_email === 'string' ? body.recipient_email.trim() : null;
      const recipientResolution = await resolveRecipientEmail(supabaseAdmin, order as OrderRecord, {
        manualPreviewEmail,
      });

      // Se nenhum e-mail for encontrado, rejeita com erro informativo claro sem inventar destinatário fictício
      if (!recipientResolution.email) {
        return new Response(
          JSON.stringify({
            success: false,
            preview_only: true,
            error: 'Nenhum e-mail de destinatário associado a este pedido (orders.customer_email está vazio, auth.users não possui e-mail para o user_id e nenhum recipient_email manual foi informado no corpo da requisição).',
            order_id: order.id,
            email_type: previewEmailType,
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const customerEmail = recipientResolution.email;
      const shortOrderId = order.id.slice(0, 8).toUpperCase();
      const customerName = order.customer_name?.trim() || 'Cliente Saturno';
      const formattedDate = new Date(order.created_at).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const rendered = renderEmailTemplate({
        order: order as OrderRecord,
        items: items || [],
        address,
        customerName,
        customerEmail,
        emailType: previewEmailType,
        shortOrderId,
        formattedDate,
      });

      return new Response(
        JSON.stringify({
          success: true,
          preview_only: true,
          order_id: order.id,
          email_type: previewEmailType,
          recipient_email: customerEmail,
          recipient_source: recipientResolution.source,
          subject: rendered.subject,
          html: rendered.html,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Configuração de parâmetros de execução da fila
    const isDryRun = body.dry_run === true || Deno.env.get('MOCK_RESEND') === 'true';

    // Se NÃO for dry_run e a chave do Resend estiver ausente, interrompe antes de alterar qualquer status
    if (!isDryRun && !cleanResendKey) {
      console.error('[SEND-ORDER-EMAIL] RESEND_API_KEY não configurada no ambiente.');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta: RESEND_API_KEY ausente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const batchSize =
      typeof body.batch_size === 'number' && Number.isInteger(body.batch_size)
        ? Math.min(Math.max(body.batch_size, 1), MAX_BATCH_SIZE)
        : DEFAULT_BATCH_SIZE;

    const staleMinutes =
      typeof body.stale_timeout_minutes === 'number' && Number.isFinite(body.stale_timeout_minutes)
        ? Math.max(body.stale_timeout_minutes, 1)
        : DEFAULT_STALE_MINUTES;

    const staleCutoffIso = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();

    // 6. Consulta de registros candidatos:
    // Critério: status = 'pending' OU (status = 'processing' abandonado há mais de staleMinutes)
    const statusOrFilter = `status.eq.pending,and(status.eq.processing,updated_at.lte.${staleCutoffIso})`;

    let query = supabaseAdmin
      .from('order_email_queue')
      .select('*')
      .or(statusOrFilter)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (body.queue_id && typeof body.queue_id === 'string') {
      query = query.eq('id', body.queue_id.trim());
    }
    if (body.order_id && typeof body.order_id === 'string') {
      query = query.eq('order_id', body.order_id.trim());
    }
    if (body.email_type && typeof body.email_type === 'string') {
      query = query.eq('email_type', body.email_type);
    }

    const { data: candidates, error: fetchError } = await query;

    if (fetchError) {
      console.error('[SEND-ORDER-EMAIL] Erro ao consultar fila de e-mails:', fetchError.message);
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar a fila de e-mails.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum e-mail pendente ou abandonado para envio na fila.',
          processed: 0,
          results: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SEND-ORDER-EMAIL] Candidatos encontrados: ${candidates.length} (isDryRun=${isDryRun})`);

    const results: ProcessResultItem[] = [];

    // 7. Processamento item a item com mecanismo seguro de lease e bloqueio de concorrência
    for (const candidate of candidates as OrderEmailQueueRecord[]) {
      // 7.1. Se o candidato já excedeu o limite de tentativas no banco
      if (candidate.attempts >= candidate.max_attempts) {
        // Bloqueio atômico: só marca failed se o registro ainda estiver no status e updated_at lidos,
        // garantindo que não altere registros já assumidos ou modificados por outro worker concorrente.
        const { data: markedFailed } = await supabaseAdmin
          .from('order_email_queue')
          .update({
            status: 'failed',
            error_message: 'Limite máximo de tentativas atingido.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', candidate.id)
          .eq('status', candidate.status)
          .eq('updated_at', candidate.updated_at)
          .select()
          .maybeSingle();

        if (markedFailed) {
          results.push({
            queue_id: candidate.id,
            order_id: candidate.order_id,
            email_type: candidate.email_type,
            recipient_email: candidate.recipient_email,
            status: 'failed',
            error_message: 'Limite máximo de tentativas atingido.',
          });
        }
        continue;
      }

      // 7.2. Tratamento para recuperação de registros abandonados em 'processing'
      // Regra de tentativas: quando um registro em 'processing' expira o timeout, significa que o worker
      // anterior sofreu interrupção inesperada (crash, timeout de execução, encerramento de container).
      // Para evitar que falhas sucessivas gerem tentativas infinitas, a recuperação de abandono
      // contabiliza a interrupção como 1 tentativa consumida.
      let targetAttempts = candidate.attempts;
      if (candidate.status === 'processing') {
        const recoveredAttempts = candidate.attempts + 1;

        if (recoveredAttempts >= candidate.max_attempts) {
          // Atingiu o limite ao somar a tentativa interrompida: finaliza com falha com proteção atômica
          const { data: failedRecovery } = await supabaseAdmin
            .from('order_email_queue')
            .update({
              status: 'failed',
              attempts: recoveredAttempts,
              error_message: 'Processamento abandonado e limite máximo de tentativas atingido.',
              updated_at: new Date().toISOString(),
            })
            .eq('id', candidate.id)
            .eq('status', 'processing')
            .eq('updated_at', candidate.updated_at)
            .select()
            .maybeSingle();

          if (failedRecovery) {
            results.push({
              queue_id: candidate.id,
              order_id: candidate.order_id,
              email_type: candidate.email_type,
              recipient_email: candidate.recipient_email,
              status: 'failed',
              error_message: 'Processamento abandonado e limite máximo de tentativas atingido.',
            });
          }
          continue;
        }

        targetAttempts = recoveredAttempts;
      }

      // 7.3. Captura do Lease (Claim) com token UUID e bloqueio atômico
      const workerLeaseToken = crypto.randomUUID();
      const updatedPayload = {
        ...(candidate.payload || {}),
        lease_token: workerLeaseToken,
        lease_acquired_at: new Date().toISOString(),
      };

      let claimQuery = supabaseAdmin
        .from('order_email_queue')
        .update({
          status: 'processing',
          attempts: targetAttempts,
          payload: updatedPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id);

      if (candidate.status === 'pending') {
        claimQuery = claimQuery.eq('status', 'pending');
      } else {
        // Recuperação de 'processing': exige que o status ainda seja 'processing',
        // que continue expirado (<= staleCutoffIso) e que updated_at não tenha sido alterado
        claimQuery = claimQuery
          .eq('status', 'processing')
          .lte('updated_at', staleCutoffIso)
          .eq('updated_at', candidate.updated_at);
      }

      const { data: claimed, error: claimError } = await claimQuery.select().maybeSingle();

      if (claimError || !claimed) {
        // Registro já assumido por outro worker concorrente
        console.log(`[SEND-ORDER-EMAIL] Item ${candidate.id} já assumido por outro worker. Pulando.`);
        continue;
      }

      const claimUpdatedAt = claimed.updated_at;

      // 7.4. Consulta do Pedido com verificação explícita de erro
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', claimed.order_id)
        .maybeSingle();

      if (orderError) {
        console.error(`[SEND-ORDER-EMAIL] Erro transitório de banco ao consultar pedido ${claimed.order_id}:`, orderError.message);

        // Regra de tentativa: falhas transitórias internas de consulta ao banco NÃO representam
        // tentativa de envio de e-mail ao provedor. Reverte para 'pending' sem incrementar attempts.
        await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
          status: 'pending',
          error_message: `Falha temporária de banco ao consultar pedido: ${orderError.message.slice(0, 300)}`,
        });

        results.push({
          queue_id: claimed.id,
          order_id: claimed.order_id,
          email_type: claimed.email_type,
          recipient_email: claimed.recipient_email,
          status: 'failed',
          error_message: 'Falha temporária de banco ao consultar pedido.',
        });
        continue;
      }

      if (!order) {
        console.error(`[SEND-ORDER-EMAIL] Pedido ${claimed.order_id} inexistente no banco.`);

        // Falha estrutural irreversível de integridade referencial: marca 'failed' imediatamente
        await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
          status: 'failed',
          error_message: 'Pedido associado não encontrado na base de dados.',
        });

        results.push({
          queue_id: claimed.id,
          order_id: claimed.order_id,
          email_type: claimed.email_type,
          recipient_email: claimed.recipient_email,
          status: 'failed',
          error_message: 'Pedido não encontrado na base de dados.',
        });
        continue;
      }

      // 7.5. Consulta dos Itens com verificação explícita de erro
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      if (itemsError) {
        console.error(`[SEND-ORDER-EMAIL] Erro transitório de banco ao consultar itens do pedido ${order.id}:`, itemsError.message);

        // Falha temporária de banco: reverte para 'pending' sem penalizar tentativas
        await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
          status: 'pending',
          error_message: `Falha temporária ao consultar itens do pedido: ${itemsError.message.slice(0, 300)}`,
        });

        results.push({
          queue_id: claimed.id,
          order_id: claimed.order_id,
          email_type: claimed.email_type,
          recipient_email: claimed.recipient_email,
          status: 'failed',
          error_message: 'Falha temporária ao consultar itens do pedido.',
        });
        continue;
      }

      if (!items || items.length === 0) {
        console.warn(`[SEND-ORDER-EMAIL] Pedido ${order.id} sem itens cadastrados. Envio cancelado.`);

        // Falha de integridade do pedido: não envia e-mail incompleto
        await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
          status: 'failed',
          error_message: 'Pedido sem itens registrados na base de dados. Envio suspenso para evitar e-mail incompleto.',
        });

        results.push({
          queue_id: claimed.id,
          order_id: claimed.order_id,
          email_type: claimed.email_type,
          recipient_email: claimed.recipient_email,
          status: 'failed',
          error_message: 'Pedido sem itens registrados. E-mail não enviado.',
        });
        continue;
      }

      // 7.6. Consulta do Endereço de Entrega (se for modalidade delivery)
      let address: AddressRecord | null = null;
      if (order.delivery_type === 'delivery') {
        if (!order.shipping_address_id) {
          console.warn(`[SEND-ORDER-EMAIL] Pedido de entrega ${order.id} sem shipping_address_id.`);

          await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
            status: 'failed',
            error_message: 'Pedido de entrega sem ID de endereço (shipping_address_id ausente).',
          });

          results.push({
            queue_id: claimed.id,
            order_id: claimed.order_id,
            email_type: claimed.email_type,
            recipient_email: claimed.recipient_email,
            status: 'failed',
            error_message: 'Endereço de entrega não referenciado no pedido.',
          });
          continue;
        }

        const { data: addr, error: addrError } = await supabaseAdmin
          .from('addresses')
          .select('*')
          .eq('id', order.shipping_address_id)
          .maybeSingle();

        if (addrError) {
          console.error(`[SEND-ORDER-EMAIL] Erro temporário ao consultar endereço ${order.shipping_address_id}:`, addrError.message);

          await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
            status: 'pending',
            error_message: `Falha temporária ao consultar endereço de entrega: ${addrError.message.slice(0, 300)}`,
          });

          results.push({
            queue_id: claimed.id,
            order_id: claimed.order_id,
            email_type: claimed.email_type,
            recipient_email: claimed.recipient_email,
            status: 'failed',
            error_message: 'Falha temporária ao consultar endereço de entrega.',
          });
          continue;
        }

        if (!addr) {
          console.warn(`[SEND-ORDER-EMAIL] Endereço ${order.shipping_address_id} não encontrado na tabela addresses.`);

          await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
            status: 'failed',
            error_message: 'Endereço de entrega não encontrado na base de dados.',
          });

          results.push({
            queue_id: claimed.id,
            order_id: claimed.order_id,
            email_type: claimed.email_type,
            recipient_email: claimed.recipient_email,
            status: 'failed',
            error_message: 'Endereço de entrega não encontrado.',
          });
          continue;
        }

        address = addr;
      }

      // 7.7. Resolução compartilhada do e-mail de destino (Fluxo Real de Fila)
      // No fluxo real, body.recipient_email é ignorado categoricamente para segurança.
      const resolution = await resolveRecipientEmail(supabaseAdmin, order as OrderRecord, {
        queueEmail: claimed.recipient_email,
      });

      if (!resolution.email) {
        console.warn(`[SEND-ORDER-EMAIL] Item ${claimed.id} sem e-mail de destino cadastrado ou válido. Marcando skipped.`);

        await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
          status: 'skipped',
          error_message: 'Destinatário sem e-mail cadastrado ou formato inválido.',
        });

        results.push({
          queue_id: claimed.id,
          order_id: claimed.order_id,
          email_type: claimed.email_type,
          recipient_email: '',
          status: 'skipped',
          error_message: 'Destinatário sem e-mail cadastrado ou formato inválido.',
        });
        continue;
      }

      const recipientEmail = resolution.email;

      // 7.8. Renderização do Template HTML
      const shortOrderId = order.id.slice(0, 8).toUpperCase();
      const customerName = order.customer_name?.trim() || 'Cliente Saturno';
      const formattedDate = new Date(order.created_at).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const rendered = renderEmailTemplate({
        order: order as OrderRecord,
        items: items as OrderItemRecord[],
        address,
        customerName,
        customerEmail: recipientEmail,
        emailType: claimed.email_type as EmailType,
        shortOrderId,
        formattedDate,
      });

      // 7.9. Tratamento para DRY-RUN / SIMULAÇÃO (Sem chamada de rede ao Resend)
      if (isDryRun) {
        console.log(`[SEND-ORDER-EMAIL] [DRY RUN] Simulação para item ${claimed.id}. Resend NÃO foi chamado.`);

        // Reverte para 'pending' liberando o lease para que o registro não fique retido em 'processing'
        await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
          status: 'pending',
        });

        results.push({
          queue_id: claimed.id,
          order_id: claimed.order_id,
          email_type: claimed.email_type,
          recipient_email: recipientEmail,
          status: 'preview',
          preview: {
            subject: rendered.subject,
            html: rendered.html,
          },
        });
        continue;
      }

      // 7.10. Idempotência e Comportamento da API Resend
      // DOCUMENTAÇÃO RESEND IDEMPOTENCY-KEY:
      // 1. Janela de retenção: O Resend retém as chaves de idempotência por 24 horas a partir da primeira requisição.
      // 2. Replay de resposta: Se uma requisição com a mesma chave e payload idêntico for reenviada dentro de 24h,
      //    o Resend não reenvia o e-mail nem consome cota adicional, retornando a resposta original (id existente).
      // 3. Payload mismatch: Se a mesma chave for reenviada dentro de 24h com payload divergente, o Resend rejeita com erro.
      // 4. Comportamento pós-24h: Após 24 horas, a chave expira e é descartada pelo Resend. Se uma tentativa for repetida
      //    após 24 horas, o Resend tratará a chave como uma nova requisição, resultando em envio de novo e-mail.
      // 5. Garantia de entrega: Trata-se de uma estratégia 'at-least-once' com janela de desduplicação de 24h, e NÃO
      //    de uma garantia incondicional 'exactly-once'.
      const idempotencyKey = `saturno-order-email-${claimed.id}`;

      // 7.11. Tentativa Efetiva de Envio via API Resend
      try {
        console.log(`[SEND-ORDER-EMAIL] Enviando via Resend com Idempotency-Key para item ${claimed.id}`);

        const resendResponse = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanResendKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            from: DEFAULT_SENDER,
            to: [recipientEmail],
            reply_to: DEFAULT_REPLY_TO,
            subject: rendered.subject,
            html: rendered.html,
          }),
        });

        if (resendResponse.ok) {
          const resendData = await resendResponse.json();
          const resendId = resendData?.id || null;

          console.log(`[SEND-ORDER-EMAIL] Sucesso no Resend! ID retornado: ${resendId}`);

          const leaseOk = await updateWithLeaseGuard(
            supabaseAdmin,
            claimed.id,
            workerLeaseToken,
            claimUpdatedAt,
            {
              status: 'sent',
              resend_id: resendId,
              sent_at: new Date().toISOString(),
              error_message: null,
            }
          );

          if (!leaseOk.success) {
            console.error(
              `[SEND-ORDER-EMAIL] ALERTA: E-mail enviado no Resend (id: ${resendId}), mas o lease expirou e o status no Supabase não foi atualizado por este worker.`
            );
          }

          results.push({
            queue_id: claimed.id,
            order_id: claimed.order_id,
            email_type: claimed.email_type,
            recipient_email: recipientEmail,
            status: 'sent',
            resend_id: resendId,
          });
        } else {
          // Erro retornado pela API do Resend (4xx ou 5xx)
          const errorText = await resendResponse.text();
          let parsedError = `HTTP ${resendResponse.status}`;
          try {
            const jsonErr = JSON.parse(errorText);
            if (jsonErr.message) parsedError = jsonErr.message;
          } catch {
            if (errorText) parsedError = errorText.slice(0, 300);
          }

          console.error(`[SEND-ORDER-EMAIL] Resend retornou erro: ${parsedError}`);

          // Tentativa efetiva realizada junto ao provedor: incrementa o contador
          const nextAttempts = (claimed.attempts || 0) + 1;
          const nextStatus = nextAttempts >= claimed.max_attempts ? 'failed' : 'pending';

          await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
            status: nextStatus,
            attempts: nextAttempts,
            error_message: parsedError.slice(0, 500),
          });

          results.push({
            queue_id: claimed.id,
            order_id: claimed.order_id,
            email_type: claimed.email_type,
            recipient_email: recipientEmail,
            status: 'failed',
            error_message: parsedError,
          });
        }
      } catch (sendErr) {
        // Falha de rede ou timeout durante a requisição ao Resend
        const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.error('[SEND-ORDER-EMAIL] Falha de rede ou timeout durante requisição ao Resend:', errMsg);

        // Tentativa de rede realizada: incrementa o contador
        const nextAttempts = (claimed.attempts || 0) + 1;
        const nextStatus = nextAttempts >= claimed.max_attempts ? 'failed' : 'pending';

        await updateWithLeaseGuard(supabaseAdmin, claimed.id, workerLeaseToken, claimUpdatedAt, {
          status: nextStatus,
          attempts: nextAttempts,
          error_message: `Falha de rede/timeout: ${errMsg.slice(0, 450)}`,
        });

        results.push({
          queue_id: claimed.id,
          order_id: claimed.order_id,
          email_type: claimed.email_type,
          recipient_email: recipientEmail,
          status: 'failed',
          error_message: errMsg,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (globalErr) {
    const errMsg = globalErr instanceof Error ? globalErr.message : String(globalErr);
    console.error('[SEND-ORDER-EMAIL] Erro não tratado na função:', errMsg);

    return new Response(
      JSON.stringify({ error: `Erro interno no processamento: ${errMsg}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
