# Guia de Troubleshooting — Mães em Ação

> **Última atualização:** 2026-04-13

Este manual contém resoluções rápidas para as ocorrências mais comuns durante o mutirão.

---

## 1. Erro "Caso Bloqueado" (HTTP 423)

**Cenário:** O defensor ou servidor tenta abrir um caso e vê uma mensagem de que o caso está vinculado a outro usuário.
- **Causa:** O sistema de **Session Locking** impede edições simultâneas para evitar corrupção de dados. O lock dura 30 minutos desde a última ação.
- **Solução (Usuário):** Aguardar o colega liberar o caso ou pedir que ele clique no botão **Liberar Caso**.
- **Solução (Admin):** Na tela de erro, administradores visualizam o botão **Forçar Liberação (Admin)**, que purga a sessão ativa imediatamente.

---

## 2. CPF não encontrado na Busca Central

**Cenário:** A assistida informa que já cadastrou, mas o CPF não retorna resultados.
- **Causa 1 (Formatação):** O CPF possuía pontos/traços no cadastro original e a busca foi feita apenas com números (ou vice-versa).
  - *Status:* Bug corrigido na v2.0 com normalização automática.
- **Causa 2 (Representante):** O caso foi cadastrado com o CPF do filho (incapaz) e a busca está sendo feita pelo CPF da mãe (ou vice-versa).
  - *Solução:* O backend agora busca nos dois campos (`cpf_assistido` e `representante_cpf`). Tente buscar por ambos os CPFs se a falha persistir.

---

## 3. Erro "Falha no Processamento IA" (status: `erro_processamento`)

**Cenário:** O caso fica preso com status de erro após o scanner.
- **Causa 1 (Timeout):** O documento era muito grande ou a rede falhou ao enviar ao Gemini Vision.
- **Causa 2 (QStash Signing):** Falha na validação da assinatura de segurança entre o QStash e o Railway.
- **Solução:** No painel administrativo do caso, clique em **Reprocessar**. Isso disparará o pipeline novamente ignorando a fila do QStash (uso do `setImmediate` local).

---

## 4. Visualizador de Documentos não abre o PDF/DOCX

**Cenário:** O preview do arquivo fica em branco ou com erro de "refused to connect".
- **Causa:** Expiração da **Signed URL** do Supabase (as URLs duram 1 hora).
- **Solução:** Recarregue a página de Detalhes do Caso para gerar novas URLs de visualização.

---

## 5. Falha ao Aceitar Assistência (Compartilhamento)

**Cenário:** O colega recebe a notificação, clica em "Aceitar", mas vê a mensagem "Caso não encontrado ou erro de permissão."
- **Causa:** Notificações antigas (antes da v2.0) não possuíam o `referencia_id`.
- **Solução:** Peça ao remetente para reenviar o pedido de colaboração. A nova notificação conterá o vínculo correto para liberar o acesso.

---

## 6. Porta da API inconsistente / ECONNREFUSED

**Cenário:** Erro de conexão (ECONNREFUSED) entre frontend e backend.
- **Causa:** O backend está rodando em uma porta diferente da configurada no frontend.
- **Solução:** Verifique o arquivo `frontend/src/utils/apiBase.js`. Em produção, a variável `VITE_API_URL` deve apontar para a URL correta do Railway. Em desenvolvimento local (Docker), deve ser `http://localhost:8001/api`.

---

## 7. Erro "Illegal constructor" / JSON BigInt

**Cenário:** O frontend lança exceção ao carregar dados de casos, frequentemente visível no console como "Illegal constructor" relacionado ao SWR.
- **Causa:** O PostgreSQL usa `BigInt` para a coluna `casos.id`. O `JSON.stringify` nativo não serializa BigInt, causando um erro na resposta HTTP.
- **Status:** **Corrigido em `601877e`** — normalizador recursivo implementado no `casosController.js` que converte todos os BigInt para String antes de retornar a resposta.
- **Se reaparecer:** Verifique se algum novo campo BigInt foi adicionado ao schema e está sendo retornado sem normalização.

---

## 8. Erro "column does not exist" no Backend

**Cenário:** O backend lança erro de SQL com "column does not exist" após deploy.
- **Causa:** O Prisma Client está desatualizado em relação ao schema real do banco, ou o schema real do banco não tem a coluna que o código espera.
- **Solução:**
  1. `docker compose exec backend npx prisma generate` — regenera o client
  2. `docker compose exec backend npx prisma db push` — aplica as migrations pendentes
  3. Verifique se o Supabase tem a coluna (via painel do Supabase > Table Editor)

---

## 9. Prisma: Erro de conexão com `directUrl`

**Cenário:** Migrations ou `prisma studio` falham com erro de autenticação ou timeout.
- **Causa:** O `DATABASE_URL` aponta para o pooler do Supabase (Transaction Mode), que não suporta migrations. É necessário o `DIRECT_URL` apontando para a conexão direta.
- **Solução:** Certifique-se que `.env` (ou `.env.docker`) contém tanto `DATABASE_URL` (pooler) quanto `DIRECT_URL` (direct connection sem `?pgbouncer=true`).

---

## 10. Caso não aparece no Dashboard do Defensor

**Cenário:** Um caso recém-criado não aparece no Dashboard do defensor mesmo após a triagem.
- **Causa mais comum:** O defensor está em uma `unidade_id` diferente da `unidade_id` vinculada ao caso. O filtro automático do `listarCasos` filtra por unidade do JWT.
- **Solução:** Verifique se o caso foi criado com a `cidade_assinatura` correta, que é mapeada para a `unidade_id` correspondente. Admin pode ver todos os casos independentemente da unidade.

---

## 11. "Invalid Date" nos campos de data

**Cenário:** Datas aparecem como "Invalid Date" na tela de detalhes do caso.
- **Causa:** O campo de data está sendo retornado como `null` ou em formato inesperado pelo backend, e o `new Date(null)` resulta em "Invalid Date".
- **Status:** **Corrigido em `601877e`** — o `casosController.js` agora normaliza datas antes de retornar.
- **Se reaparecer:** Verifique se o campo está sendo retornado no JOIN da query de detalhes.

---

## Dicas Gerais de Debug

```bash
# Ver logs em tempo real do backend
docker compose logs -f backend

# Verificar status dos containers
docker compose ps

# Reiniciar apenas o backend
docker compose restart backend

# Acessar o banco via psql
docker compose exec db psql -U maes -d maes_em_acao

# Ver logs do Prisma (queries SQL)
# Adicionar ao .env: DEBUG="prisma:query"
```
