# Correção definitiva do estado de autenticação

## Objetivo
Unificar a sessão do Supabase, os componentes React e os guards do TanStack Router em uma única fonte de autenticação, sem alterar banco, RLS, produtos, pedidos ou visual.

## Implementação
- Montar o `AuthProvider` na entrada real do cliente e renderizar o `RouterProvider` com `context={{ auth }}` atualizado a cada mudança.
- Simplificar o roteador para manter apenas um contexto inicial de carregamento, removendo a ponte global incompleta e fontes duplicadas de usuário.
- Fazer o `AuthProvider` carregar a sessão inicial, acompanhar um único `onAuthStateChange`, carregar o perfil do mesmo `user.id` e expor login, logout e atualização do perfil.
- Remover o atraso artificial do login; após `signIn`, navegar para `/` quando `profile.role` for `customer` e para `/admin` somente quando for `admin`.
- Ajustar guards de conta e administração para ler exclusivamente `context.auth` e aguardar `authReady` sem tratar carregamento como logout.
- Fazer Header, Home, carrinho e checkout consumirem o mesmo `useAuth`; checkout só redirecionará quando a inicialização terminou e não houver usuário.
- Fazer logout limpar a sessão e navegar de forma consistente, sem usar invalidação como segunda fonte de autenticação.

## Validação
- Executar verificação TypeScript e conferir o build automático.
- Testar no navegador sessão inicial, login, destino por role, cabeçalho, recarga, conta, carrinho, checkout e logout.
- Observar console e erros em execução durante todo o fluxo.
- Como este Supabase externo não fornece credenciais de teste ao ambiente, validar customer/admin de ponta a ponta com sessões disponíveis; registrar claramente qualquer etapa bloqueada por falta de conta autenticada.

## Arquivos previstos
- Nova entrada do cliente.
- `src/hooks/useAuth.tsx`, `src/lib/auth.ts`, `src/router.tsx`, `src/routes/__root.tsx`.
- `src/routes/login.tsx`, `src/routes/account.tsx`, `src/routes/admin.tsx`, `src/routes/admin.categories.tsx`.
- `src/components/customer/Header.tsx`, `src/routes/index.tsx`, `src/hooks/useCart.ts`, `src/routes/cart.tsx`, `src/routes/checkout.tsx`.
- Ajustes mínimos adicionais somente se necessários para a compilação diretamente afetada.
