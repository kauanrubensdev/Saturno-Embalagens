# Base CSS da SaturnoEmbalagens

## Objetivo
Consolidar o design system global existente sem alterar páginas, componentes, textos, rotas ou funcionalidades.

## Alterações planejadas
- Atualizar somente `src/styles.css` para o padrão Tailwind CSS v4 já instalado.
- Preservar e organizar a paleta oficial em tokens semânticos para temas claro e escuro.
- Mapear os tokens para utilitários Tailwind, evitando um segundo sistema de cores conflitante.
- Completar escalas reutilizáveis de tipografia, containers, espaçamento, raios e sombras leves.
- Manter e completar as classes existentes de botões, cards, formulários, cabeçalho e navegação, incluindo `.select` e `.nav`.
- Aplicar estilos base mínimos e seguros, sem transformar a aparência das páginas atuais.

## Restrições preservadas
- Nenhuma alteração em componentes, conteúdo, rotas, Supabase, autenticação, carrinho, checkout ou regras de negócio.
- Nenhuma aplicação em massa das novas classes.
- Sem redesign, gradientes, glassmorphism, neon, sombras pesadas ou animações exageradas.

## Validação
- Confirmar que todas as rotas continuam registradas.
- Validar compilação, erros TypeScript e carregamento das páginas públicas existentes.
- Exercitar visualmente os acessos de login e cadastro e o fluxo público do carrinho, sem modificar dados.
- Conferir os diagnósticos finais do preview.
