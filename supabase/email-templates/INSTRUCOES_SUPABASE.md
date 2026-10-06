# Configuração do Supabase Auth para Recuperação de Senha

Este documento contém o passo a passo exato para configurar o Supabase Auth no Dashboard do projeto **hlgcnxbtfrififuwtykx**.

---

## 1. Configuração de URLs (Site URL e Redirect URLs)

Acesse o painel do Supabase:
🔗 **URL Direta:** [https://supabase.com/dashboard/project/hlgcnxbtfrififuwtykx/auth/url-configuration](https://supabase.com/dashboard/project/hlgcnxbtfrififuwtykx/auth/url-configuration)

Ou navegue pelo menu:
> **Authentication** ➔ **URL Configuration**

### 1.1. Site URL
- **Site URL atual provável:** `http://localhost:...` ou similar
- **Altere para:**
  ```text
  https://saturno-embalagens.vercel.app
  ```

### 1.2. Redirect URLs
Adicione as seguintes URLs na lista de URLs permitidas (**Redirect URLs**):
- `https://saturno-embalagens.vercel.app/reset-password`
- `https://saturno-embalagens.vercel.app/**`
- `http://localhost:5173/reset-password` *(para desenvolvimento local Vite)*
- `http://localhost:5173/**`
- `http://localhost:8080/reset-password` *(se utilizar a porta 8080 localmente)*
- `http://localhost:8080/**`

> ⚠️ **Importante:** Não remova URLs existentes caso haja outras configuradas. Apenas adicione as listadas acima e clique em **Save**.

---

## 2. Template de E-mail de Recuperação de Senha

Acesse o painel de templates de e-mail do Supabase:
🔗 **URL Direta:** [https://supabase.com/dashboard/project/hlgcnxbtfrififuwtykx/auth/templates](https://supabase.com/dashboard/project/hlgcnxbtfrififuwtykx/auth/templates)

Ou navegue pelo menu:
> **Authentication** ➔ **Email Templates** ➔ **Reset Password**

### 2.1. Subject (Assunto do E-mail)
Substitua o assunto em inglês por:
```text
Redefina sua senha — Saturno Embalagens
```

### 2.2. Message Body (Corpo do E-mail)
Substitua todo o conteúdo HTML pelo código contido no arquivo:
📂 `supabase/email-templates/reset-password.html`

O template já inclui:
- Identidade visual da Saturno (Fundo `#001621`, Laranja `#FF4103`, Texto claro `#F5F5DC`).
- Texto 100% em português.
- Variável oficial `{{ .ConfirmationURL }}` no botão `[ Redefinir minha senha ]`.
- Compatibilidade com Gmail, iPhone, Outlook, Apple Mail e modo escuro/claro.
- Sem JavaScript e sem URLs fixas em localhost.

Após colar o HTML e o Assunto, clique em **Save**.
