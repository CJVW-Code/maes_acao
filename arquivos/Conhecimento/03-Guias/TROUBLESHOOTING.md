# Guia de Troubleshooting — Mães em Ação

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
- **Causa 1 (Timeout):** O documento era muito grande ou a rede falhou ao enviar ao GPT-4o-mini.
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

## 6. Porta da API inconsistente

**Cenário:** Erro de conexão (ECONNREFUSED) entre frontend e backend.
- **Causa:** O backend está rodando na porta 8000 mas o frontend tenta a 8001.
- **Solução:** Verifique o arquivo `frontend/src/utils/apiBase.js`. Em produção e dev v2.0, a porta padrão deve ser **8000**.
