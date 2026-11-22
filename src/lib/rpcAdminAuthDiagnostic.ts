/**
 * Diagnóstico temporário de autorização da RPC admin_enqueue_order_created.
 * 
 * Este módulo roda apenas no navegador durante desenvolvimento (import.meta.env.DEV).
 * Não executa chamadas automaticamente.
 * Não imprime tokens, credenciais ou dados sensíveis.
 */
import { supabase } from '@/integrations/supabase/client';

export async function testAdminEnqueueAuthorization(): Promise<{
  success: boolean;
  status?: string;
  code?: string;
  message?: string;
  data?: any;
}> {
  console.log('[TESTE RPC] Executando teste de autorização para admin_enqueue_order_created...');
  console.log('[TESTE RPC] Parâmetro p_order_id: "00000000-0000-0000-0000-000000000000"');

  try {
    const { data, error } = await supabase.rpc('admin_enqueue_order_created' as any, {
      p_order_id: '00000000-0000-0000-0000-000000000000',
    });

    if (error) {
      console.warn('[TESTE RPC] Resultado: Operação rejeitada pelo banco (Esperado para cliente comum):', {
        code: error.code || 'UNKNOWN',
        message: error.message || 'Sem mensagem de erro',
      });
      return {
        success: false,
        code: error.code,
        message: error.message,
      };
    }

    console.info('[TESTE RPC] Resultado: Operação autorizada pelo banco:', {
      success: data?.success ?? true,
      message: data?.message ?? 'Executado com sucesso',
    });
    return {
      success: true,
      data,
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[TESTE RPC] Exceção na chamada:', { message: msg });
    return {
      success: false,
      message: msg,
    };
  }
}

// Vincula ao window estritamente em ambiente de desenvolvimento no client
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).testAdminEnqueueAuthorization = testAdminEnqueueAuthorization;
  console.info(
    '[TESTE RPC] Diagnóstico carregado. Para testar autorização, execute: await window.testAdminEnqueueAuthorization()'
  );
}
